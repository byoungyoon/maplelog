import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const books = sqliteTable("books", {
  mode: text("mode").primaryKey(),
  revision: integer("revision").notNull(),
  payload: text("payload").notNull(),
});
