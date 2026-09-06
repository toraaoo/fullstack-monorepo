import {
  type Dialect,
  defineDialect,
  Query,
  type SelectRequest,
  type TruncateRequest,
  type UpdateRequest,
  type UpsertRequest,
} from "#src/dialect/index"

const INSERTED_COLUMN = "__seed_inserted"

const INTROSPECT = `
SELECT COALESCE(JSON_AGG(t ORDER BY t.name), '[]'::JSON) AS tables
FROM (
  SELECT
    c.relname AS name,
    n.nspname AS schema,
    (
      SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
        'name', a.attname,
        'property', a.attname,
        'nullable', NOT a.attnotnull,
        'hasDefault', a.atthasdef OR a.attidentity <> ''
      ) ORDER BY a.attnum), '[]'::JSON)
      FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    ) AS columns,
    (
      SELECT COALESCE((
        SELECT JSON_AGG(k.attname ORDER BY o.ord)
        FROM UNNEST(pc.conkey) WITH ORDINALITY AS o(attnum, ord)
        JOIN pg_attribute k ON k.attrelid = c.oid AND k.attnum = o.attnum
      ), '[]'::JSON)
      FROM pg_constraint pc
      WHERE pc.conrelid = c.oid AND pc.contype = 'p'
      LIMIT 1
    ) AS "primaryKey",
    (
      SELECT COALESCE(JSON_AGG(u.cols), '[]'::JSON)
      FROM (
        SELECT (
          SELECT JSON_AGG(k.attname ORDER BY o.ord)
          FROM UNNEST(pc.conkey) WITH ORDINALITY AS o(attnum, ord)
          JOIN pg_attribute k ON k.attrelid = c.oid AND k.attnum = o.attnum
        ) AS cols
        FROM pg_constraint pc
        WHERE pc.conrelid = c.oid AND pc.contype IN ('p', 'u')
      ) AS u
      WHERE u.cols IS NOT NULL
    ) AS "uniqueKeys",
    (
      SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
        'columns', (
          SELECT JSON_AGG(k.attname ORDER BY o.ord)
          FROM UNNEST(pc.conkey) WITH ORDINALITY AS o(attnum, ord)
          JOIN pg_attribute k ON k.attrelid = c.oid AND k.attnum = o.attnum
        ),
        'table', ft.relname,
        'foreignColumns', (
          SELECT JSON_AGG(fk.attname ORDER BY o.ord)
          FROM UNNEST(pc.confkey) WITH ORDINALITY AS o(attnum, ord)
          JOIN pg_attribute fk ON fk.attrelid = ft.oid AND fk.attnum = o.attnum
        )
      )), '[]'::JSON)
      FROM pg_constraint pc
      JOIN pg_class ft ON ft.oid = pc.confrelid
      WHERE pc.conrelid = c.oid AND pc.contype = 'f'
    ) AS "foreignKeys"
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' AND n.nspname = ANY(CURRENT_SCHEMAS(FALSE))
) t
`

export const postgresDialect: Dialect = defineDialect({
  name: "postgres",

  insertedColumn: INSERTED_COLUMN,

  quoteIdentifier(value: string): string {
    return `"${value.replaceAll('"', '""')}"`
  },

  placeholder(index: number): string {
    return `$${index}`
  },

  upsert(request: UpsertRequest): Query {
    const query = new Query()

    query.text("INSERT INTO ").table(request.table).text(" (")
    query.join(request.columns, ", ", (column) => query.identifier(column))
    query.text(") VALUES ")

    query.join(request.rows, ", ", (row) => {
      query.text("(")
      query.join(request.columns, ", ", (column) => {
        if (row[column] === undefined) query.text("DEFAULT")
        else
          query.value(row[column], { table: request.table.name, name: column })
      })
      query.text(")")
    })

    query.text(" ON CONFLICT (")
    query.join(request.conflictColumns, ", ", (column) =>
      query.identifier(column)
    )
    query.text(") DO UPDATE SET ")

    const assignments =
      request.updateColumns.length > 0
        ? request.updateColumns
        : [request.conflictColumns[0] as string]

    query.join(assignments, ", ", (column) => {
      query.identifier(column).text(" = EXCLUDED.").identifier(column)
    })

    if (request.touchColumn && request.updateColumns.length > 0) {
      query.text(", ").identifier(request.touchColumn).text(" = NOW()")
    }

    query.text(" RETURNING ")
    query.join(request.returning, ", ", (column) => query.identifier(column))
    query.text(", (xmax = 0) AS ").identifier(INSERTED_COLUMN)

    return query
  },

  update(request: UpdateRequest): Query {
    const query = new Query()
    const columns = Object.keys(request.values)

    query.text("UPDATE ").table(request.table).text(" SET ")

    query.join(columns, ", ", (column) => {
      query.identifier(column).text(" = ").value(request.values[column], {
        table: request.table.name,
        name: column,
      })
    })

    if (request.touchColumn) {
      query.text(", ").identifier(request.touchColumn).text(" = NOW()")
    }

    query.text(" WHERE ")

    query.join(Object.keys(request.where), " AND ", (column) => {
      query.identifier(column).text(" = ").value(request.where[column], {
        table: request.table.name,
        name: column,
      })
    })

    return query
  },

  select(request: SelectRequest): Query {
    const query = new Query()

    query.text("SELECT ")
    query.join(request.columns, ", ", (column) => query.identifier(column))
    query.text(" FROM ").table(request.table).text(" WHERE ")

    if (request.keyColumns.length === 1) {
      const only = request.keyColumns[0] as string

      query.identifier(only).text(" IN (")
      query.join(request.keys, ", ", (key) =>
        query.value(key[0], { table: request.table.name, name: only })
      )
      query.text(")")

      return query
    }

    query.text("(")
    query.join(request.keyColumns, ", ", (column) => query.identifier(column))
    query.text(") IN (")

    query.join(request.keys, ", ", (key) => {
      query.text("(")
      query.join(key, ", ", (value, index) =>
        query.value(value, {
          table: request.table.name,
          name: request.keyColumns[index] as string,
        })
      )
      query.text(")")
    })

    query.text(")")

    return query
  },

  truncate(request: TruncateRequest): Query {
    const query = new Query()

    query.text("TRUNCATE TABLE ")
    query.join(request.tables, ", ", (table) => query.table(table))
    query.text(" RESTART IDENTITY CASCADE")

    return query
  },

  introspect(): Query {
    return new Query().raw(INTROSPECT)
  },
})
