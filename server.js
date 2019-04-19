const fetch = require("node-fetch");
const express = require('express');
const env = require('dotenv').config()
const _ = require('lodash');

const accessToken = env.parsed.GIT_HOST;
const apiUrl = 'https://api.github.com/graphql';

// Create an express server and a GraphQL endpoint
const app = express();

const fetchQuery = (query, res) => {
    return fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });
}

const fetchQueryAndSend = (query, res) => {
    fetchQuery(query, res)
    .then(res => res.text())
    .then(body => res.status(200).send(body))
}

console.log('Available requests :');

//Organization infos
console.log('/organization/{organization}');
app.get('/organization/:organization', function (req, res) {
    const query = `
        query {
            organization(login:"${req.params.organization}") {
                name
                description
                avatarUrl
                location
                url
            }
        }
    `;
    fetchQueryAndSend(query, res);
});

//All users
console.log('/organization/{organization}/users');
app.get('/organization/:organization/users', function (req, res) {
    const query = `
        query {
            organization(login:"${req.params.organization}") {
                membersWithRole(first:20` + (req.query.after ? `, after:"${req.query.after}"` : ``) + `) {
                    totalCount
                        nodes {
                            name
                            login
                            location
                        }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        }
    `;
    fetchQueryAndSend(query, res);
});

//Users infos
console.log('/user/{login}');
app.get('/user/:login', function (req, res) {
    const query = `
        query {
            user(login:"${req.params.login}") {
                login
                bio
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
    fetchQueryAndSend(query, res);
});

//User contributions
function isValidNumberLikes(str) {
    var n = Math.floor(Number(str));
    return n !== Infinity && String(n) === str && n >= 0;
}
console.log('/user/{login}/contributions');
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
    fetchQuery(query, res)
        .then(res => res.text())
        .then(body => {
            pullRequests = JSON.parse(body).data.user.pullRequests.nodes;
            pullRequests = _.uniqBy(pullRequests, 'headRepository.id');
            pullRequests = _.filter(pullRequests, ({ headRepository }) => 
                headRepository.stargazers.totalCount >= (isValidNumberLikes(req.query.likes) ? req.query.likes : 0));
            res.status(200).send(pullRequests);
        })
});

//3 most stared repo
console.log('/organization/{organization}/repositories');
app.get('/organization/:organization/repositories', function (req, res) {
    const query = `
        query {
            search(query: "org:${req.params.organization}", type: REPOSITORY, first: 3) {
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
    fetchQueryAndSend(query, res);
});

app.listen(4000, () => console.log('\nExpress GraphQL Server Now Running On localhost:4000'));