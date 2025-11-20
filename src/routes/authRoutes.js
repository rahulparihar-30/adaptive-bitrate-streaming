import { Router } from "express";
import Register from "../auth/register.js";
import Login from "../auth/login.js";

const authRoute = Router()

authRoute.use('/register',Register);
authRoute.use('/login',Login);

export default authRoute