const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

// Helper function to read the users file
const readUsersFile = () => {
  const filePath = path.join(__dirname, "../data/users.json");
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ users: [] }));
  }
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
};

// Helper function to write data to users file
const writeUsersFile = (data) => {
  const filePath = path.join(__dirname, "../data/users.json");
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Registration
exports.register = (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: "All Fields are required" });
  }

  const usersData = readUsersFile();
  const userExists = usersData.users.find((user) => user.email === email);

  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = { email, password: hashedPassword, Name: name };

  usersData.users.push(newUser);
  writeUsersFile(usersData);

  res.status(201).json({ message: "User registered successfully" });
};

// Login
exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  const usersData = readUsersFile();
  const user = usersData.users.find((user) => user.email === email);

  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ email: user.email }, "REGISTER_ROCKET", {
    expiresIn: "1h",
  });

  res.json({ message: "Login successful", token });
};

// Forgot Password - Step 1: Request password reset
exports.forgotPassword = (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Username is required" });
  }

  const usersData = readUsersFile();
  const user = usersData.users.find((user) => user.email === email);
  console.log("USER", user);
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  // Generate a password reset token (valid for 1 hour)
  const resetToken = jwt.sign({ email: user.email }, "REGISTER_ROCKET", {
    expiresIn: "1h",
  });

  // In a real app, you'd send this token via email.
  console.log(
    `Password reset token (for demo purposes): http://localhost:4000/reset-password/${resetToken}`
  );

  res.json({
    message:
      "Password reset link has been sent (token printed to the console).",
    resetToken,
  });
};

// Reset Password - Step 2: User sets a new password
exports.resetPassword = (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res
      .status(400)
      .json({ message: "Reset token and new password are required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(resetToken, "REGISTER_ROCKET");
  } catch (error) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }

  const { email } = decoded;
  const usersData = readUsersFile();
  const user = usersData.users.find((user) => user.email === email);
  console.log("USER", user);
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  // Hash the new password
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  user.password = hashedPassword;

  // Update the password in the file
  writeUsersFile(usersData);

  res.json({ message: "Password has been successfully reset" });
};

// Add/Edit Data
exports.addEditData = (req, res) => {
  const { email, data } = req.body;

  if (!username || !data) {
    return res.status(400).json({ message: "Username and data are required" });
  }

  const usersData = readUsersFile();
  const user = usersData.users.find((user) => user.email === email);

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  user.data = data; // Update user data
  writeUsersFile(usersData);

  res.json({ message: "Data updated successfully" });
};
