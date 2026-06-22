const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const usersFile = path.join(__dirname, "..", "data", "users.json");

function readUsers() {
  try {
    if (!fs.existsSync(usersFile)) return [];
    const raw = fs.readFileSync(usersFile, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    return [];
  }
}

function writeUsers(users) {
  const dir = path.dirname(usersFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
}

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phoneNumber, companyName } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const users = readUsers();
    const exists = users.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now(),
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).toLowerCase().trim(),
      password: hashed,
      phoneNumber: phoneNumber || null,
      companyName: companyName || null,
      role: "user",
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    writeUsers(users);

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "devsecret", { expiresIn: "7d" });

    const { password: _p, ...safe } = user;
    res.status(201).json({ user: safe, token });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Missing email or password" });

    const users = readUsers();
    const user = users.find((u) => u.email && u.email.toLowerCase() === String(email).toLowerCase());
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password || "");
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const payload = { id: user.id, email: user.email, role: user.role || "user" };
    const token = jwt.sign(payload, process.env.JWT_SECRET || "devsecret", { expiresIn: "7d" });

    const { password: _p, ...safe } = user;
    res.json({ user: safe, token });
  } catch (err) {
    next(err);
  }
};
