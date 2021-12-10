const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const dotEnv = require("dotenv").config();
const axios = require("axios");
const bodyParser = require("body-parser");

const {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleChangeRoomCharacteristics,
} = require("./roomsAndUsers/roomHandlers");

const port = process.env.PORT || 6021;

let allRestaurants = [];
let acceptedRestaurants = [];

const getRestaurants = async () => {
  try {
    const yelpRes = await axios.get(process.env.YELP_RESTAURANT_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${process.env.YELP_API_KEY}`,
      },
      params: {
        location: "Waterloo, Ontario",
      },
    });
    return yelpRes.data.businesses;
  } catch (error) {
    console.error(error);
  }
};

console.log(allRestaurants);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/prototype.html");
});

app.get("/restaurants", async (req, res) => {
  restaurantList = await getRestaurants();
  restaurantList = restaurantList.map((restaurant) => {
    return restaurant.name;
  });
  res.json({
    restaurants: restaurantList,
  });
});

app.post("/create-room", (req, res) => {
  console.log("Hi tanson");
  const { userId, roomId } = handleCreateRoom(req.body.username);
  res.status(200).json({ userId, roomId });
});

io.on("connection", (socket) => {
  socket.on("accept restaurant", (restaurant) => {
    console.log("accepted:", restaurant);
    acceptedRestaurants = [...acceptedRestaurants, restaurant];
    io.emit("new match", restaurant);
  });
  socket.on("chat message", (msg) => {
    console.log("new msg", msg);
    io.emit("chat message", msg);
  });
  console.log("a user has connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  // user creates a new room
  // socket.on("create_room", handleCreateRoom(io, socket));

  // user joins an existing room
  socket.on("join_room", handleJoinRoom(io));

  // user leaves a room
  socket.on("leave_room", handleLeaveRoom(io));

  // changing a room's characteristics
  // newCharacteristics is an object with the new characteristics
  socket.on("change_room_characteristics", handleChangeRoomCharacteristics(io));
});

// in a room, listen for "user_joined", then add this user to
// a list of users for display/validating match purposes

// if a user enters a roomID, direct that user to the room
app.get("/:roomId", function (req, res) {
  console.log(req.params);
  res.sendFile(__dirname + "/prototype.html");
});

// if you send a text to someone, link to app store

server.listen(port, () => {
  console.log("listening on *:3000");
});
