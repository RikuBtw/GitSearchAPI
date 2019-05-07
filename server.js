require('dotenv').config()

const express = require('express');
const session = require('express-session');
const request = require('request');
const fetch = require("node-fetch");
const randomString = require('randomstring');
const qs = require('qs');
const _ = require('lodash');

const apiUrl = 'https://api.github.com/graphql';
const port = process.env.PORT || 3000;

// Create an express server
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(
    session({
        secret: randomString.generate(),
        resave: false,
        saveUninitialized: false
    })
);

const fetchQuery = (req, res, query) => {
    if (!req.session.access_token){
        res.redirect('/');
        return;
    }
    return fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: {
            'Authorization': `Bearer ${req.session.access_token}`,
        },
    });
}

const fetchQueryAndSend = (req, res, query) => {
    const fetchedQuery = fetchQuery(req, res, query);
    if (!fetchedQuery) return;
    fetchedQuery
        .then(res => res.text())
        .then(body => res.status(200).send(body));
}

app.post('/login', (req, res) => {
    res.redirect(process.env.AUTH_HOST);
});

app.all('/redirect', (req, res) => {
    const code = req.query.code;
    const returnedState = req.query.state;
    const csrf = req.query.csrf;
    if (csrf === returnedState) {
        request.post(
            {
                url:
                    'https://github.com/login/oauth/access_token?' +
                    qs.stringify({
                        client_id: process.env.CLIENT_ID,
                        client_secret: process.env.CLIENT_SECRET,
                        code: code,
                        redirect_uri: process.env.HOST + "/redirect",
                        state: csrf
                    })
            },
            (error, response, body) => {
                req.session.access_token = qs.parse(body).access_token;
                res.redirect(process.env.CLIENT_HOST);
            }
        );
    } else {
        res.redirect('/');
    }
});

app.all('/', function (req, res) {
    res.status(200).send([{'token': req.session.access_token}]);
});


//Users infos
app.get('/viewer', function (req, res) {
    const query = `
        query {
            viewer {
                login
                name
                bio
                email
                websiteUrl
                url 
                followers {
                    totalCount
                }
                location
                avatarUrl
                repositories(last:5){
                    totalCount
                    edges{
                        node{
                            name
                            description
                        }
                    }
                }
            }
        }
    `;
    fetchQueryAndSend(req, res, query);
});

//Users organizations
app.get('/user/:login/organizations', function (req, res) {
    const query = `
        query {
            user(login:"${req.params.login}") {
            organizations (first:10) {
                nodes{
                    name
                    }
                }
            }
        }
    `;
    fetchQuery(req, res, query)
        .then(res => res.text())
        .then(body => {
            organizations = JSON.parse(body).data.user.organizations.nodes;
            organizations = _.uniqBy(organizations, 'name');
            res.status(200).send(organizations);
        })
});

//Organization infos
app.get('/organization/:organization', function (req, res) {
    const query = `
        query {
            organization(login:"${req.params.organization}") {
                name
                description
                avatarUrl
                location
                url
                email
            }
        }
    `;
    fetchQueryAndSend(req, res, query);
});

//All users
app.get('/organization/:organization/users', function (req, res) {
    const query = `
        query {
            organization(login:"${req.params.organization}") {
                membersWithRole(first:18` + (req.query.after ? `, after:"${req.query.after}"` : ``) + `) {
                    totalCount
                        nodes {
                            login
                            avatarUrl
                        }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        }
    `;
    fetchQueryAndSend(req, res, query);
});

//User contributions
function isValidNumberLikes(str) {
    var n = Math.floor(Number(str));
    return n !== Infinity && String(n) === str && n >= 0;
}
app.get('/user/:login/contributions', function (req, res) {
    const query = `
        query {
            user(login:${req.params.login}) {
                pullRequests(last:100` + (req.query.after ? `, after:"${req.query.after}"` : ``) + `){
                    totalCount
                    nodes{
                        headRepository{
                            id
                            name
                            owner {
                             login
                            }
                            stargazers {
                                totalCount
                            }
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        }   
    `;
    fetchQuery(req, res, query)
        .then(res => res.text())
        .then(body => {
            pullRequests = JSON.parse(body).data.user.pullRequests.nodes;
            pullRequests = _.uniqBy(pullRequests, 'headRepository.id');
            pullRequests = _.filter(pullRequests, ({ headRepository }) => 
                headRepository.stargazers.totalCount >= (isValidNumberLikes(req.query.likes) ? req.query.likes : 0));
            res.status(200).send(pullRequests);
        })
});

//5 most stared repo
app.get('/organization/:organization/repositories', function (req, res) {
    const query = `
        query {
            search(query: "org:${req.params.organization}", type: REPOSITORY, first: 5) {
                repositoryCount
                edges {
                    node {
                        ... on Repository {
                        name
                        descriptionHTML
                            languages(first:5) {
                            totalCount
                            edges{
                                node{
                                    name
                                }
                            }
                        }
                        stargazers {
                            totalCount
                        }
                        updatedAt
                        }
                    }
                }
            }
        }
    `;
    fetchQueryAndSend(req, res, query);
});

app.listen(port, () => console.log('\nAPI Now Running on port:' + port));