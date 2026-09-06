import { StrUtils } from "@shared/utils/str.utils"
import { describe, expect, it } from "vitest"

describe("slicing around a needle", () => {
  it.each([
    ["after", () => StrUtils.after("user@example.com", "@"), "example.com"],
    ["afterLast", () => StrUtils.afterLast("a/b/c", "/"), "c"],
    ["before", () => StrUtils.before("user@example.com", "@"), "user"],
    ["beforeLast", () => StrUtils.beforeLast("a/b/c", "/"), "a/b"],
    ["between", () => StrUtils.between("key[value]", "[", "]"), "value"],
  ])("%s", (_label, act, expected) => {
    expect(act()).toBe(expected)
  })

  it.each([
    ["after", () => StrUtils.after("abc", "@")],
    ["afterLast", () => StrUtils.afterLast("abc", "@")],
    ["before", () => StrUtils.before("abc", "@")],
    ["beforeLast", () => StrUtils.beforeLast("abc", "@")],
  ])("%s returns the subject when the needle is absent", (_label, act) => {
    expect(act()).toBe("abc")
  })
})

describe("case conversion", () => {
  it.each([
    ["camel", "foo_bar baz-qux", "fooBarBazQux"],
    ["kebab", "fooBar baz_qux", "foo-bar-baz-qux"],
    ["snake", "fooBar baz-qux", "foo_bar_baz_qux"],
    ["studly", "foo_bar baz", "FooBarBaz"],
    ["headline", "foo_bar-baz", "Foo Bar Baz"],
    ["title", "hello wide world", "Hello Wide World"],
  ])("%s turns %s into %s", (method, input, expected) => {
    const convert = StrUtils[method as "camel"]

    expect(convert(input)).toBe(expected)
  })

  it.each([
    ["ucfirst", () => StrUtils.ucfirst("abc"), "Abc"],
    ["lcfirst", () => StrUtils.lcfirst("ABC"), "aBC"],
    ["upper", () => StrUtils.upper("aBc"), "ABC"],
    ["lower", () => StrUtils.lower("AbC"), "abc"],
  ])("%s", (_label, act, expected) => {
    expect(act()).toBe(expected)
  })

  it("splits on capitals", () => {
    expect(StrUtils.ucsplit("fooBarBaz")).toEqual(["foo", "Bar", "Baz"])
  })
})

describe("slug", () => {
  it("lowercases and joins on the separator", () => {
    expect(StrUtils.slug("Hello, World!")).toBe("hello-world")
  })

  it("collapses runs and strips the edges", () => {
    expect(StrUtils.slug("  --Hello -- World--  ")).toBe("hello-world")
  })

  it("takes a custom separator", () => {
    expect(StrUtils.slug("Hello World", "_")).toBe("hello_world")
  })
})

describe("truncation", () => {
  it("cuts at a character count and appends the marker", () => {
    expect(StrUtils.limit("abcdefg", 3)).toBe("abc...")
  })

  it("leaves a short subject alone", () => {
    expect(StrUtils.limit("ab", 3)).toBe("ab")
  })

  it("cuts at a word count", () => {
    expect(StrUtils.words("one two three four", 2)).toBe("one two...")
  })

  it("leaves a short subject alone when counting words", () => {
    expect(StrUtils.words("one two", 5)).toBe("one two")
  })

  it("takes a leading slice", () => {
    expect(StrUtils.take("abcdef", 3)).toBe("abc")
  })
})

describe("excerpt", () => {
  it("windows around the phrase and marks the trailing cut", () => {
    expect(StrUtils.excerpt("the quick brown fox", "quick", 4)).toBe(
      "the quick bro..."
    )
  })

  it("marks a leading cut too", () => {
    expect(StrUtils.excerpt("aaaaaaaaaa needle bbbbbbbbbb", "needle", 3)).toBe(
      "...aa needle bb..."
    )
  })

  it("returns nothing when the phrase is absent", () => {
    expect(StrUtils.excerpt("the quick brown fox", "zebra")).toBe("")
  })
})

describe("padding and masking", () => {
  it.each([
    ["padLeft", () => StrUtils.padLeft("7", 3, "0"), "007"],
    ["padRight", () => StrUtils.padRight("7", 3, "0"), "700"],
    ["padBoth", () => StrUtils.padBoth("x", 5, "-"), "--x--"],
  ])("%s", (_label, act, expected) => {
    expect(act()).toBe(expected)
  })

  it("leans right when the padding is odd", () => {
    expect(StrUtils.padBoth("x", 4, "-")).toBe("-x--")
  })

  it("never truncates to reach the target length", () => {
    expect(StrUtils.padLeft("abcdef", 3, "0")).toBe("abcdef")
  })

  it("masks a leading run", () => {
    expect(StrUtils.mask("1234567890", "*", 0, 6)).toBe("******7890")
  })

  it("masks to the end when given no length", () => {
    expect(StrUtils.mask("1234567890", "*", 6)).toBe("123456****")
  })
})

describe("whitespace and repetition", () => {
  it("collapses runs of whitespace", () => {
    expect(StrUtils.squish("  a   b \n c  ")).toBe("a b c")
  })

  it("collapses runs of any repeated character", () => {
    expect(StrUtils.deduplicate("aabbcc")).toBe("abc")
  })

  it.each([
    ["trim", () => StrUtils.trim("  a  "), "a"],
    ["ltrim", () => StrUtils.ltrim("  a  "), "a  "],
    ["rtrim", () => StrUtils.rtrim("  a  "), "  a"],
  ])("%s", (_label, act, expected) => {
    expect(act()).toBe(expected)
  })

  it("wraps at a width", () => {
    expect(StrUtils.wordWrap("aaa bbb ccc", 3)).toBe("aaa\nbbb\nccc\n")
  })

  it("counts words", () => {
    expect(StrUtils.wordCount("one  two\nthree")).toBe(3)
  })
})

describe("affixes", () => {
  it.each([
    [
      "chopStart removes the prefix",
      () => StrUtils.chopStart("v1.2", "v"),
      "1.2",
    ],
    [
      "chopStart is a no-op otherwise",
      () => StrUtils.chopStart("1.2", "v"),
      "1.2",
    ],
    ["chopEnd removes the suffix", () => StrUtils.chopEnd("a.ts", ".ts"), "a"],
    [
      "chopEnd is a no-op otherwise",
      () => StrUtils.chopEnd("a.js", ".ts"),
      "a.js",
    ],
    ["start adds the prefix", () => StrUtils.start("path", "/"), "/path"],
    ["start does not double it", () => StrUtils.start("/path", "/"), "/path"],
    ["finish adds the cap", () => StrUtils.finish("dir", "/"), "dir/"],
    ["finish does not double it", () => StrUtils.finish("dir/", "/"), "dir/"],
  ])("%s", (_label, act, expected) => {
    expect(act()).toBe(expected)
  })

  it("wraps with one delimiter on both sides", () => {
    expect(StrUtils.wrap("x", "*")).toBe("*x*")
  })

  it("wraps with distinct delimiters", () => {
    expect(StrUtils.wrap("x", "<", ">")).toBe("<x>")
  })

  it("unwraps a matched pair", () => {
    expect(StrUtils.unwrap("*x*", "*")).toBe("x")
  })

  it("leaves an unmatched pair alone", () => {
    expect(StrUtils.unwrap("*x", "*")).toBe("*x")
  })
})

describe("containment", () => {
  it("matches any of several needles", () => {
    expect(StrUtils.contains("hello world", ["zebra", "world"])).toBe(true)
  })

  it("matches a single needle", () => {
    expect(StrUtils.contains("hello world", "hello")).toBe(true)
  })

  it("requires every needle for containsAll", () => {
    expect(StrUtils.containsAll("hello world", ["hello", "zebra"])).toBe(false)
  })

  it("negates contains", () => {
    expect(StrUtils.doesntContain("hello", "zebra")).toBe(true)
  })

  it.each([
    ["startsWith", () => StrUtils.startsWith("abc", "ab"), true],
    ["endsWith", () => StrUtils.endsWith("abc", "bc"), true],
  ])("%s", (_label, act, expected) => {
    expect(act()).toBe(expected)
  })

  it("counts occurrences", () => {
    expect(StrUtils.substrCount("banana", "an")).toBe(2)
  })
})

describe("predicates", () => {
  it("matches a wildcard pattern", () => {
    expect(StrUtils.is("foobar", "foo*")).toBe(true)
    expect(StrUtils.is("barfoo", "foo*")).toBe(false)
  })

  it.each([
    ["1e4b48a1-0f1c-4c3f-9e2a-7c9f4b1d2e3a", true],
    ["not-a-uuid", false],
  ])("reads %s as a uuid: %s", (input, expected) => {
    expect(StrUtils.isUuid(input)).toBe(expected)
  })

  it.each([
    ["01ARZ3NDEKTSV4RRFFQ69G5FAV", true],
    ["01arz3ndektsv4rrffq69g5fav", false],
    ["too-short", false],
  ])("reads %s as a ulid: %s", (input, expected) => {
    expect(StrUtils.isUlid(input)).toBe(expected)
  })

  it.each([
    ['{"a":1}', true],
    ["not json", false],
  ])("reads %s as json: %s", (input, expected) => {
    expect(StrUtils.isJson(input)).toBe(expected)
  })

  it.each([
    ["https://example.com", true],
    ["example.com", false],
  ])("reads %s as a url: %s", (input, expected) => {
    expect(StrUtils.isUrl(input)).toBe(expected)
  })

  it.each([
    ["plain ascii", true],
    ["café", false],
  ])("reads %s as ascii: %s", (input, expected) => {
    expect(StrUtils.isAscii(input)).toBe(expected)
  })
})

describe("substitution", () => {
  it("swaps every listed pair", () => {
    expect(
      StrUtils.swap(":greeting :name", { ":greeting": "Hello", ":name": "Ada" })
    ).toBe("Hello Ada")
  })

  it("substitutes in order, so a later pair can rewrite an earlier result", () => {
    expect(StrUtils.swap("a", { a: "b", b: "c" })).toBe("c")
  })

  it("has no word boundaries", () => {
    expect(StrUtils.swap("a and b", { a: "1", b: "2" })).toBe("1 1nd 2")
  })

  it("replaces a slice", () => {
    expect(StrUtils.substrReplace("abcdef", "X", 1, 2)).toBe("aXdef")
  })

  it("replaces to the end when given no length", () => {
    expect(StrUtils.substrReplace("abcdef", "X", 1)).toBe("aX")
  })

  it("takes a slice by offset and length", () => {
    expect(StrUtils.substr("abcdef", 1, 2)).toBe("bc")
  })

  it("strips diacritics", () => {
    expect(StrUtils.transliterate("café crème")).toBe("cafe creme")
  })

  it("base64-encodes", () => {
    expect(StrUtils.toBase64("hi")).toBe("aGk=")
  })
})

describe("naive pluralisation", () => {
  it("appends an s", () => {
    expect(StrUtils.plural("item")).toBe("items")
  })

  it("drops a trailing s", () => {
    expect(StrUtils.singular("items")).toBe("item")
  })

  it("leaves a word with no trailing s alone", () => {
    expect(StrUtils.singular("item")).toBe("item")
  })
})

describe("generators", () => {
  it("makes a random string of the requested length", () => {
    expect(StrUtils.random(24)).toMatch(/^[A-Za-z0-9]{24}$/)
  })

  it("defaults to 16 characters", () => {
    expect(StrUtils.random()).toHaveLength(16)
  })

  it("does not repeat itself", () => {
    expect(StrUtils.random(32)).not.toBe(StrUtils.random(32))
  })

  it("makes a v4-shaped uuid", () => {
    expect(StrUtils.uuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it("makes a uuid its own predicate accepts", () => {
    expect(StrUtils.isUuid(StrUtils.uuid())).toBe(true)
  })
})

describe("misc", () => {
  it("reads a character by index", () => {
    expect(StrUtils.charAt("abc", 1)).toBe("b")
  })

  it("measures length", () => {
    expect(StrUtils.lengthString("abc")).toBe(3)
  })
})
