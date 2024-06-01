import { Link } from "@/components/Link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import { User, UserSchema } from "@/lib/types";
import { useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export const Login = () => {
  const form = useForm<User>({
    resolver: zodResolver(UserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  const { login } = useContext(AuthContext) as AuthContextType;
  const [error, setError] = useState(undefined);
  const navigate = useNavigate();

  const onSubmit = (data: User) => {
    login(data)
      .then(() => navigate("/"))
      .catch((e) => {
        return setError(e.response?.data || e.message);
      });
  };

  return (
    <div className="flex justify-around">
      <div className="text-center">Imagen</div>
      <Card className="shadow-md p-3">
        <CardHeader>
          <CardTitle className="font-bold">Log in</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-5"
            >
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && <p className="text-red-500">{error}</p>}
              <Button type="submit">Log In</Button>
              <span className="text-sm">
                Don't have an account? <Link to="/signup">Sign Up</Link>
              </span>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
