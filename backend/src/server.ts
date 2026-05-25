import { createBackendApp } from "./app";

const port = Number(process.env.PORT || 4000);
const app = createBackendApp();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
