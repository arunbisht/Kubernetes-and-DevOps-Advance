const express = require("express");
const pool = require("./db");
require("dotenv").config();

const app = express();

app.get("/", (req, res) => {
  res.send("Employee API Running - v2.0");
});

app.get("/employees", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM employees");

    res.status(200).json(rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Database error",
    });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date(),
    pod: process.env.HOSTNAME, // shows which pod answered
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
