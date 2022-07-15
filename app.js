const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDbObjectToResponseObject2 = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//Authentication-Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API-1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT * FROM user
    WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    }
  }
});

//API-2
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStates = `
    SELECT * FROM state;`;
  const responseObject = await db.all(getAllStates);
  response.send(
    responseObject.map((eachState) =>
      convertDbObjectToResponseObject(eachState)
    )
  );
});

// API-3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getSpecificState = `
    SELECT * FROM state
    WHERE state_id=${stateId};`;
  const uniqueResults = await db.get(getSpecificState);
  response.send(convertDbObjectToResponseObject(uniqueResults));
});

// API-4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrict = `
    INSERT INTO district
    (district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  const createDistrictTable = await db.run(createDistrict);
  response.send("District Successfully Added");
});

// API-5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getSpecificDistrict = `
    SELECT * FROM district
    WHERE district_id=${districtId};`;
    const requestDistrict = await db.get(getSpecificDistrict);
    response.send(convertDbObjectToResponseObject2(requestDistrict));
  }
);

// API-6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE FROM district
    WHERE district_id=${districtId};`;
    const deleteResult = await db.run(deleteQuery);
    response.send("District Removed");
  }
);

// API-7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
    UPDATE district
    SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

// API-8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
