import { sequelize } from "../config/db.js";
import { DataTypes } from "sequelize";

const User = sequelize.define('User',{
    id:{
        type:DataTypes.INTEGER,
        autoIncrement:true,
        primaryKey:true
    },
    username:{
        type:DataTypes.STRING,
        allowNull:true,
        unique:true
    },
    name:{
        type:DataTypes.STRING,
        allowNull:false,
    },
    email:{
        type:DataTypes.STRING,
        allowNull:false,
        unique:true
    },
    password:{
        type:DataTypes.STRING,
        allowNull:false,
    },
    profilePictureUrl:{
        type:DataTypes.STRING,
        allowNull:true,
    },
    refreshToken:{
        type:DataTypes.STRING,
        allowNull:true,
    }
},{
    timestamps:true
})
export default User;