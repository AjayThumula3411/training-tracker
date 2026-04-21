import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  override: true,
});

const prisma = new PrismaClient();

export default prisma;
