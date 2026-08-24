import { vi } from "vitest";
import "./common.setup";

vi.mock("@/database/accountTable");
vi.mock("@/database/templateTable");
vi.mock("@/database/fileTable");

export {};