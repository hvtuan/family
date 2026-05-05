declare namespace App {
  interface Locals {
    user?: {
      id: string;
      email: string;
      role: "admin" | "editor" | "branch_editor";
      branch: "noi" | "ngoai" | "both" | null;
    };
  }
}
