const express = require("express");
const router = express.Router();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const SECRET = "trackia_secret";

// REGISTER
router.post("/register", async (req,res)=>{
const {name,email,password,role} = req.body;
const hash = await bcrypt.hash(password,10);
const user = new User({
name,
email,
password: hash,
role
});

await user.save();
res.json({message:"User created"});
});

// LOGIN
router.post("/login", async (req,res)=>{
const {email,password} = req.body;
const user = await User.findOne({email});

if(!user){
return res.status(400).json({error:"User not found"});
}

const match = await bcrypt.compare(password,user.password);

if(!match){
return res.status(400).json({error:"Invalid password"});
}

const token = jwt.sign(
  { id: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "24h" }
)

res.json({token});

});

module.exports = router;