import { z } from "zod";

const requiredString = (req?: string) => {
  return z
    .string()
    .trim()
    .min(1, { message: req || "This field is required" });
};

export const UserSchema = z.object({
  username: requiredString().max(50, {
    message: "Username cannot exceed 50 characters",
  }),
  password: requiredString().max(100, {
    message: "Password cannot exceed 100 characters",
  }),
});

export type User = z.infer<typeof UserSchema>;
