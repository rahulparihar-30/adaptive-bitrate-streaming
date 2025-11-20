import User from "./Users.js";
import Video from "./Video.js";
import { sequelize } from "../config/db.js";
sequelize.sync({alter:true,logging:false})
User.hasMany(Video,{foreignKey:'userId'})
Video.belongsTo(User,{foreignKey:'userId'})

export {User,Video}