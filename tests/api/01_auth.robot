*** Settings ***
Library         RequestsLibrary
Library         Collections
Resource        ../resources/keywords.robot
Resource        ../resources/variables.robot

Suite Setup     Create API Session

*** Test Cases ***
TC-AUTH-01 Staff Login With Valid Credentials
    [Tags]    auth    smoke
    ${body}=    Create Dictionary    email=${STAFF_EMAIL}    password=${STAFF_PASSWORD}
    ${resp}=    POST On Session    api    /auth/login    json=${body}
    Assert Status    ${resp}    200
    Assert Response Has Key    ${resp.json()}    accessToken
    Assert Response Has Key    ${resp.json()}    refreshToken
    Log    Login OK: token=${resp.json()["accessToken"][:20]}...

TC-AUTH-02 Staff Login With Wrong Password Returns 401
    [Tags]    auth    negative
    ${body}=    Create Dictionary    email=${STAFF_EMAIL}    password=wrongpassword
    ${resp}=    POST On Session    api    /auth/login    json=${body}    expected_status=any
    Assert Status    ${resp}    401

TC-AUTH-03 Staff Login With Unknown Email Returns 401
    [Tags]    auth    negative
    ${body}=    Create Dictionary    email=nobody@nowhere.com    password=whatever
    ${resp}=    POST On Session    api    /auth/login    json=${body}    expected_status=any
    Should Be True    ${resp.status_code} in [401, 404]

TC-AUTH-04 Get Current User Profile Requires Auth
    [Tags]    auth    smoke
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${resp}=    GET On Session    api    /auth/me    headers=${headers}
    Assert Status    ${resp}    200
    Assert Response Has Key    ${resp.json()}    email
    Should Be Equal    ${resp.json()["email"]}    ${STAFF_EMAIL}

TC-AUTH-05 Protected Endpoint Fails Without Token
    [Tags]    auth    security
    ${resp}=    GET On Session    api    /auth/me    expected_status=any
    Assert Status    ${resp}    401

TC-AUTH-06 Token Refresh Works
    [Tags]    auth    smoke
    ${body}=    Create Dictionary    email=${STAFF_EMAIL}    password=${STAFF_PASSWORD}
    ${resp}=    POST On Session    api    /auth/login    json=${body}
    ${refresh_token}=    Get From Dictionary    ${resp.json()}    refreshToken
    ${refresh_body}=    Create Dictionary    refreshToken=${refresh_token}
    ${refresh_resp}=    POST On Session    api    /auth/refresh    json=${refresh_body}
    Assert Status    ${refresh_resp}    200
    Assert Response Has Key    ${refresh_resp.json()}    accessToken

TC-AUTH-07 Login Missing Fields Returns 400
    [Tags]    auth    negative    validation
    ${body}=    Create Dictionary    email=${STAFF_EMAIL}
    ${resp}=    POST On Session    api    /auth/login    json=${body}    expected_status=any
    Should Be True    ${resp.status_code} in [400, 422]
