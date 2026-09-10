import { pool } from "../infrastructure/database.js";
import type { Pool } from "pg";

export interface CreatePostInput {
  title: string;
  content: string;
  expectedSubject: string;
  expectedCategory: string;
}

export interface PostRecord {
  id: string;
  title: string;
  content: string;
  expectedSubject: string;
  expectedCategory: string;
  createdAt: Date;
  updatedAt: Date;
}

type PostRow = {
  id: string;
  title: string;
  content: string;
  expected_subject: string;
  expected_category: string;
  created_at: Date;
  updated_at: Date;
};

function mapPostRow(row: PostRow): PostRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    expectedSubject: row.expected_subject,
    expectedCategory: row.expected_category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostRepository {
  public constructor(private readonly database: Pool = pool) {}

  public async create(input: CreatePostInput): Promise<PostRecord> {
    const result = await this.database.query<PostRow>(
      `
        INSERT INTO posts (title, content, expected_subject, expected_category)
        VALUES ($1, $2, $3, $4)
        RETURNING id, title, content, expected_subject, expected_category, created_at, updated_at
      `,
      [input.title, input.content, input.expectedSubject, input.expectedCategory],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Post insert returned no row.");
    }

    return mapPostRow(row);
  }

  public async findById(id: string): Promise<PostRecord | null> {
    const result = await this.database.query<PostRow>(
      `
        SELECT id, title, content, expected_subject, expected_category, created_at, updated_at
        FROM posts
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? mapPostRow(row) : null;
  }
  public async update(
    id: string,
    input: CreatePostInput,
  ): Promise<PostRecord> {
    const result = await this.database.query<PostRow>(
      `
        UPDATE posts
        SET
          title = $1,
          content = $2,
          expected_subject = $3,
          expected_category = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING id, title, content, expected_subject, expected_category, created_at, updated_at
      `,
      [
        input.title,
        input.content,
        input.expectedSubject,
        input.expectedCategory,
        id,
      ],
    );
  
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Post not found: ${id}`);
    }
  
    return mapPostRow(row);
  }
  public async list(): Promise<PostRecord[]> {
    const result = await this.database.query<PostRow>(
      `
        SELECT id, title, content, expected_subject, expected_category, created_at, updated_at
        FROM posts
        ORDER BY created_at ASC, id ASC
      `,
    );

    return result.rows.map(mapPostRow);
  }
}

export const postRepository = new PostRepository();
