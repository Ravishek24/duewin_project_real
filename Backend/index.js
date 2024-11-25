import express from 'express';
import dotenv from 'dotenv';
import { sequelize, connectDB } from './config/db.js';

connectDB();

dotenv.config(); 

const app = express();

const PORT = process.env.SERVER_PORT;

app.listen(
    PORT,
    () => console.log(`Server running on port ${PORT}`)
);

app.get('/fruits',(req, res) => {
    res.send({
        apple: 2,
        banana: 12
    })
});


//runs on http://localhost:8000/fruits