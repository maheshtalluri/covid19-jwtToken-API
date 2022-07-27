const express = require("express");

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const path = require("path");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDBAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("server running at http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB error at: ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
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

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeaders = request.headers["authorization"];

  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split("")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secretCode", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

// jwtToken to login user

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getLoginUserDetails = `
    SELECT *
    FROM user
    WHERE username = "${username}";`;

  const dbUser = await database.get(getLoginUserDetails);

  if (dbUser === undefined) {
    response.status(400);
    response("Invalid user");
  } else {
    const isPassword = await bcrypt.compare(password, dbUser.password);

    if (isPassword === true) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "secretCode");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// GET all the states

app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `
    SELECT *
    FROM state;`;

  const dbUser = await database.all(getStatesQuery);
  response.send(dbUser);
});

// GET the specific state details

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetails = `
    SELECT *
    FROM state
    WHERE state_id = ${stateId};`;

  const dbUser = await database.get(getStateDetails);

  response.send(convertStateDbObjectToResponseObject(dbUser));
});

// Create district in District table

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrict = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES ("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  await database.run(createDistrict);

  response.send("District Successfully Added");
});

// GET the district details based on district id

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictDetails = `
    SELECT *
    FROM district
    WHERE district_id = ${districtId};`;

    const dbUser = await database.get(getDistrictDetails);

    response.send(convertDistrictDbObjectToResponseObject(dbUser));
  }
);

// delete district from district table

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteDistrict = `
    DELETE FROM district WHERE district_id = ${districtId};`;

    await database.run(deleteDistrict);

    response.send("District Removed");
  }
);

// update district

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;

    const updateDistrictDetails = `
    UPDATE district
    SET
    district_name = "${districtName}",
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};`;

    await database.run(updateDistrictDetails);

    response.send("District Details Updated");
  }
);

// det statistics of state based on state_id

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    //   const { cases, cured, active, deaths } = request.body;
    const { stateId } = request.params;

    const getStateStatistics = `
    SELECT
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};`;

    const dbUser = await database.get(getStateStatistics);

    response.send(dbUser);
  }
);

// get state name based on district id

app.get(
  "/districts/:districtId/details/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getStateNameOfDistrict = `
    SELECT state_name
    FROM state NATURAL JOIN district
    WHERE district_id = ${districtId};`;

    const dbUser = await database.get(getStateNameOfDistrict);

    response.send(dbUser);
  }
);

module.exports = app;
