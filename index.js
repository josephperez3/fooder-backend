const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const dotEnv = require("dotenv").config();
const cors = require("cors");
const io = require("socket.io")(server, {
  cors: {
    origin: process.env.APP_ENDPOINT,
    methods: ["GET", "POST"],
  },
});
const axios = require("axios");
const bodyParser = require("body-parser");
const Rooms = require("./roomsAndUsers/newRooms");
app.use(
  cors({
    origin: process.env.APP_ENDPOINT,
  })
);

const {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleChangeRoomCharacteristics,
} = require("./roomsAndUsers/roomHandlers");
const { findRoomId } = require("./utilities");

const port = process.env.PORT || 6021;

let allRestaurants = [];
let acceptedRestaurants = [];
let rooms = new Rooms();

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
  // const { userId, roomId } = handleCreateRoom(req.body.username); // should perform a "legit" check
  const roomId = rooms.addRoom();
  res.status(200).json({ roomId });
});

io.on("connection", (socket) => {
  socket.on("accept restaurant", (restaurant) => {
    console.log("accepted:", restaurant);
    acceptedRestaurants = [...acceptedRestaurants, restaurant];
    io.emit("new match", restaurant);
  });
  socket.on("join", ({ username, roomId }) => {
    console.log("user", username, "id", roomId);
    socket.join(roomId);
    console.log(socket.rooms);
    rooms.addUserToRoom(username, socket.id, roomId);
    const usernames = rooms.getRoomUsers(roomId);
    io.to(roomId).emit("user joined", usernames); // emit username instead
    console.log("socket info:", socket.id);
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

  socket.on("request restaurants", async () => {
    console.log("REQUEST", socket.rooms);
    const room = findRoomId(socket.rooms);
    console.log("room", room);
    const restaurants = await getRestaurants();
    console.log(restaurants[0]);
    io.in(room).emit("found restaurants", restaurants);
    console.log("found restaurants!");
  });

  socket.on("accept restaurant", (restaurantId) => {
    const roomId = findRoomId(socket.rooms);
    const userId = socket.id;
    const match = rooms.acceptRestaurant(roomId, userId, restaurantId);
    if (match) {
      console.log("match! emitting..");
      socket.emit("update matches", rooms.getMatchedRestaurants(roomId));
    }
  });
});

// in a room, listen for "user joined", then add this user to
// a list of users for display/validating match purposes

// if a user enters a roomID, direct that user to the room
// app.post("/:roomId", function (req, res) {
//   console.log(req.body);
//   handleJoinRoom(io)(req.body.username, req.params.roomId);
//   res.status(200).json({ status: 200 });
//   // res.sendFile(__dirname + "/prototype.html");
// });

// if you send a text to someone, link to app store

server.listen(port, () => {
  console.log("listening on *:" + port);
});
