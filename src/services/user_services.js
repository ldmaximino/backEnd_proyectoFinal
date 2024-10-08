//Third party imports
import jwt from "jsonwebtoken";

//Local imports
import Services from "./class.services.js";
import { TIMETOKEN, SECRET_KEY, MINUTESLIMIT } from "../config/config.js";
import UserRepository from "../persistence/repository/user_repository.js";
import { hashearPass, verifyPassHasheada, isLastConnectionValid } from "../utils/utils.js";
import { USERADMIN, KEYUSERADMIN } from '../config/config.js';
import factory from "../persistence/daos/factory.js";
import { sendEMailToUser } from "./mailing_services.js";

const { userDao, cartDao } = factory;
const userRepository = new UserRepository(); 

export default class UserService extends Services {
  constructor() {
    super(userDao);
  }

  generateToken = (user, time = `${TIMETOKEN}m`) => {
    const id = user._id || user.id;
    const payload = {
      userId: id,
    };
  
    return jwt.sign(payload, SECRET_KEY, {
      expiresIn: time,
    });
  };

  async getUserByEmail(email) {
    try {
      return await userDao.getUserByEmail(email);
    } catch (error) {
      throw new Error(error);
    }
  }

  async getUserById(id) {
    try {
      return await userRepository.getUserById(id);
    } catch (error) {
      throw new Error(error);
    }
  }

  async getAllUsers() {
    try {
      const users = await userDao.getAllUsers();
      return users;
    } catch (error) {
      throw new Error(error);
    }
  }

  async register(user) {
    try {
      const { email, password } = user;
      const existUser = await userDao.getUserByEmail(email);
      if (!existUser) {
        const cartUser = await cartDao.createCart();
        const idCart = cartUser.cart._id || cartUser.cart.id;
        const newUser = await userDao.register({
          ...user,
          password: hashearPass(password),
          cart: idCart,
        });
        await sendEMailToUser(user,'register');
        return newUser;
      } else {
        return null;
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  async login(user) {
    try {
      let userExist = "";
      const { email, password } = user;
      if (email.toLowerCase() === USERADMIN && password === KEYUSERADMIN) {
        userExist = await userDao.getUserByEmail(email);
        if (!userExist) {
          const cartUser = await cartDao.createCart();
          const idCart = cartUser.cart._id || cartUser.cart.id;
          userExist = await userDao.register({
            ...user,
            first_name: "Coderhouse",
            last_name: "Academy",
            role: "admin",
            password: hashearPass(password),
            cart: idCart,
          });
          await sendEMailToUser(user,'register');
        } else {
          const passValid = verifyPassHasheada(password, userExist.password);
          if (!passValid) return null;
        }
      } else {
        userExist = await userDao.getUserByEmail(email);
        if (!userExist) return null;
        const passValid = verifyPassHasheada(password, userExist.password);
        if (!passValid) return null;
        if(!userExist.active) return null;
      }
      await this.updateLastConnection(userExist._id);
      return userExist;
    } catch (error) {
      throw new Error(error);
    }
  }

  async generateNewPass(user) {
    try {
      const token = this.generateToken(user, '1h');
      return token;
    } catch (error) {
      throw new Error(error);
    }
  }

  
  async updatePass(pass, user){
    try {
      //Check that the new password is not the same as the old one
      const passEqual = verifyPassHasheada(pass, user.password);
      if (passEqual) return null;
      const newPass = hashearPass(pass);
      return await this.dao.update(user._id, { password: newPass });
    } catch (error) {
      throw new Error(error)
    }
  }

  async changeUserRole(user){
    try {
      const newRole = (user.role === 'premium' ? 'user' : 'premium');
      return await this.dao.update(user._id, { role: newRole });
    } catch (error) {
      throw new Error(error);
    }
  }

  async deleteAllUsers() {
    try {
      return await this.dao.deleteAllUsers();
    } catch (error) {
      throw new Error(error);
    }
  }

  async updateLastConnection(userID) {
    try {
      return await this.dao.update(userID, { last_connection: new Date() });
    } catch (error) {
      throw new Error(error);
    }
  }

  async checkUsersLastConnection() {
    try {
      const usersInactive = [];
      const users = await this.dao.getAll();
      if(users.length > 0) {
        for (const user of users) {
          if(user.last_connection && user.active && isLastConnectionValid(user.last_connection, MINUTESLIMIT)) {
            console.log(`It's been more than ${MINUTESLIMIT} minutos since user: ${user._id} email: ${user.email} last connection`);
            await this.dao.update(user._id, { active: false });
            usersInactive.push({
              "id": user._id,
              "email": user.email });
            //send email
            const msjHoras = (MINUTESLIMIT / 60).toFixed(2);
            const msgLastConnection = `${msjHoras} horas`;
            await sendEMailToUser(user,'inactive', null , msgLastConnection);
          }          
        }
      }
      return usersInactive;
    } catch (error) {
      throw new Error(error);
    }
  }
}
