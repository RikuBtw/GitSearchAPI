const fetch = require("node-fetch");
const express = require('express');

const accessToken = '6964939e38e66381885ad25e912861d71f945675';
const apiUrl = 'https://api.github.com/graphql';

// Create an express server and a GraphQL endpoint
var app = express();

const fetchQuery = (query, res) => {
    fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    })
    .then(res => res.text())
    .then(body => res.status(200).send(body))
}

//Users requests all
app.get('/organization/:organization/users', function (req, res) {
    query = `
        query OrganizationUserPR {
        organization(login: ${req.params.organization}) {
            membersWithRole(first:20` + (req.query.after ? `after: ${req.query.after.replace(/(=)/g, '')}` : ``) + `) {
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
    fetchQuery(query, res);
});
//Users requests one
app.get('/user/:login', function (req, res) {
    query = `
        query UserInformations {
            repositoryOwner(login: ${req.params.login}) {
                login
                ... on User {
                    bio
                    followers {
                        totalCount
                    }
                    location
                    avatarUrl
                    projects(last:5){
                        totalCount
                        edges{
                            node{
                                name
                                body
                            }
                        }
                    }
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
        }
    `;
    fetchQuery(query, res);
});

app.listen(4000, () => console.log('Express GraphQL Server Now Running On localhost:4000/graphql'));