// Browser paths are Latvian (users see them); code refers to them by English keys.
export const paths = {
  login: "/pieteikties",
  signup: "/registreties",
  forgotPassword: "/aizmirsta-parole",
  checker: "/",
  history: "/vesture",
  settings: "/iestatijumi",
  documentPattern: "/dokuments/:id",
  document: (id: string) => `/dokuments/${id}`,
} as const;
