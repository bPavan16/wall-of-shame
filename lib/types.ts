export type Role = "admin" | "member";

export interface UserRecord {
  username: string;
  name: string;
  role: Role;
  passwordHash: string;
}

export interface PublicUser {
  username: string;
  name: string;
  role: Role;
}

export interface Quote {
  id: string;
  quote: string;
  by: string; // who said it
  createdBy: string; // username of who posted it
  createdAt: string; // ISO date
  upvotes: number;
}
