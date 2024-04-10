import { Link } from "@/components/Link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";

export const Login = () => {
  return (
    <div className="flex justify-around">
      <div className="text-center">Imagen</div>
      <Card className="shadow-md p-3">
        <CardHeader>
          <CardTitle className="font-bold">Log in</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input type="text" name="username" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input type="password" name="password" />
            </div>
            <Button>Log In</Button>
            <Link to="/signup">Don't have an account? Sign Up</Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
