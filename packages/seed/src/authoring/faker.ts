import { faker } from "@faker-js/faker"

export { faker }

export function seedFaker(seed?: number): void {
  if (seed === undefined) faker.seed()
  else faker.seed(seed)
}
