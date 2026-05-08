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

// Vite ?raw imports — inline file contents (markdown, sql, txt) into the
// build output as strings. Used by /admin/help to bundle docs/admin/setup.md.
declare module "*.md?raw" {
  const content: string;
  export default content;
}
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
declare module "*.txt?raw" {
  const content: string;
  export default content;
}
