*** Settings ***
Library     RequestsLibrary
Library     Collections
Library     JSONLibrary
Resource    ${CURDIR}/variables.robot

*** Keywords ***
Create API Session
    Create Session    api    ${API_URL}    verify=False

Staff Login And Get Token
    Create API Session
    ${body}=    Create Dictionary    email=${STAFF_EMAIL}    password=${STAFF_PASSWORD}
    ${resp}=    POST On Session    api    /auth/login    json=${body}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${token}=    Get From Dictionary    ${resp.json()}    accessToken
    RETURN    ${token}

Get Auth Headers
    [Arguments]    ${token}
    ${headers}=    Create Dictionary    Authorization=Bearer ${token}    Content-Type=application/json
    RETURN    ${headers}

Get Restaurant ID
    [Arguments]    ${token}
    ${headers}=    Get Auth Headers    ${token}
    ${resp}=    GET On Session    api    /settings/restaurant    headers=${headers}
    Should Be Equal As Integers    ${resp.status_code}    200
    ${id}=    Get From Dictionary    ${resp.json()}    id
    RETURN    ${id}

Get Restaurant ID From Slug
    Create API Session
    ${resp}=    GET On Session    api    /settings/restaurant/${RESTAURANT_SLUG}/public
    Should Be Equal As Integers    ${resp.status_code}    200
    ${id}=    Get From Dictionary    ${resp.json()}    id
    RETURN    ${id}

Customer Register Or Login
    [Arguments]    ${restaurant_id}
    Create API Session
    ${body}=    Create Dictionary    phone=${CUST_PHONE}    name=${CUST_NAME}    password=Test@1234
    ${resp}=    POST On Session    api    /customers/${restaurant_id}/register    json=${body}    expected_status=any
    Run Keyword If    '${resp.status_code}' == '409'
    ...    Log    Customer already exists — logging in
    ${login_body}=    Create Dictionary    phone=${CUST_PHONE}    password=Test@1234
    ${login_resp}=    POST On Session    api    /customers/${restaurant_id}/login    json=${login_body}
    Should Be Equal As Integers    ${login_resp.status_code}    200
    ${token}=    Get From Dictionary    ${login_resp.json()}    accessToken
    RETURN    ${token}

Assert Response Has Key
    [Arguments]    ${resp_json}    ${key}
    Dictionary Should Contain Key    ${resp_json}    ${key}

Assert Status
    [Arguments]    ${resp}    ${expected}
    Should Be Equal As Integers    ${resp.status_code}    ${expected}
    ...    msg=Expected ${expected} got ${resp.status_code}: ${resp.text}
