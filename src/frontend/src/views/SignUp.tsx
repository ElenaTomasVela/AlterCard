import { Link } from "@/components/Link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import { User } from "@/lib/types";
import axios from "axios";
import React, { useContext } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

export const SignUp = () => {
  const { register, handleSubmit } = useForm<User>();
  const { signup } = useContext(AuthContext) as AuthContextType;
  const navigate = useNavigate();

  const onSubmit = (data: User) => {
    signup(data);
    navigate("/");
  };

  return (
    <div className="flex justify-around">
      <div className="text-center">Imagen</div>
      <Card className="shadow-md p-3">
        <CardHeader>
          <CardTitle className="font-bold">Sign Up</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input type="text" {...register("username")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input type="password" {...register("password")} />
            </div>
            <Button>Sign Up</Button>
            <Link to="/login">Already have an account? Log in</Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
