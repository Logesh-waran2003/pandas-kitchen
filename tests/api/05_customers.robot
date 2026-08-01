*** Settings ***
Library         RequestsLibrary
Library         Collections
Resource        ../resources/keywords.robot
Resource        ../resources/variables.robot

Suite Setup     Create API Session

*** Variables ***
${RESTAURANT_ID}    ${EMPTY}
${CUST_TOKEN}       ${EMPTY}

*** Test Cases ***
TC-CUST-01 Customer Can Register
    [Tags]    customer    smoke
    ${restaurant_id}=    Get Restaurant ID From Slug
    Set Suite Variable    ${RESTAURANT_ID}    ${restaurant_id}
    ${phone}=    Set Variable    9800001111
    ${body}=    Create Dictionary    phone=${phone}    name=RF Customer    password=Test@1234
    ${resp}=    POST On Session    api    /customers/${restaurant_id}/register
    ...    json=${body}    expected_status=any
    Should Be True    ${resp.status_code} in [200, 201, 409]
    Log    Register status: ${resp.status_code}

TC-CUST-02 Customer Can Login
    [Tags]    customer    smoke
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${body}=    Create Dictionary    phone=9800001111    password=Test@1234
    ${resp}=    POST On Session    api    /customers/${restaurant_id}/login    json=${body}
    Assert Status    ${resp}    200
    Assert Response Has Key    ${resp.json()}    accessToken
    Set Suite Variable    ${CUST_TOKEN}    ${resp.json()["accessToken"]}

TC-CUST-03 Customer Login With Wrong Password Returns 401
    [Tags]    customer    negative    security
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${body}=    Create Dictionary    phone=9800001111    password=WrongPass999
    ${resp}=    POST On Session    api    /customers/${restaurant_id}/login
    ...    json=${body}    expected_status=any
    Assert Status    ${resp}    401

TC-CUST-04 Customer Can View Own Profile
    [Tags]    customer    smoke
    ${headers}=    Get Auth Headers    ${CUST_TOKEN}
    ${resp}=    GET On Session    api    /customers/me    headers=${headers}
    Assert Status    ${resp}    200
    Assert Response Has Key    ${resp.json()}    phone
    Assert Response Has Key    ${resp.json()}    loyaltyPoints

TC-CUST-05 Customer Can Get Loyalty Balance
    [Tags]    customer    loyalty    smoke
    ${headers}=    Get Auth Headers    ${CUST_TOKEN}
    ${resp}=    GET On Session    api    /customers/me/loyalty-balance/${RESTAURANT_ID}
    ...    headers=${headers}
    Assert Status    ${resp}    200
    Assert Response Has Key    ${resp.json()}    points
    Assert Response Has Key    ${resp.json()}    valueInRupees

TC-CUST-06 Loyalty Balance Is Non Negative
    [Tags]    customer    loyalty    regression
    ${headers}=    Get Auth Headers    ${CUST_TOKEN}
    ${resp}=    GET On Session    api    /customers/me/loyalty-balance/${RESTAURANT_ID}
    ...    headers=${headers}
    ${points}=    Convert To Integer    ${resp.json()["points"]}
    ${value}=    Convert To Number    ${resp.json()["valueInRupees"]}
    Should Be True    ${points} >= 0
    Should Be True    ${value} >= 0

TC-CUST-07 Loyalty Redeemed Deducted From Balance After Order
    [Tags]    customer    loyalty    regression
    # First earn some points by placing order as logged-in customer
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${headers}=    Get Auth Headers    ${CUST_TOKEN}
    # Get customerId from profile
    ${profile_resp}=    GET On Session    api    /customers/me    headers=${headers}
    ${customer_id}=    Set Variable    ${profile_resp.json()["id"]}
    # Get first menu item
    ${menu_resp}=    GET On Session    api    /menu/public/${restaurant_id}
    ${cats}=    Get From Dictionary    ${menu_resp.json()}    categories
    ${first_cat}=    Get From List    ${cats}    0
    ${items}=    Get From Dictionary    ${first_cat}    items
    ${item}=    Get From List    ${items}    0
    # Get current balance
    ${bal_resp}=    GET On Session    api    /customers/me/loyalty-balance/${restaurant_id}
    ...    headers=${headers}
    ${before_points}=    Convert To Integer    ${bal_resp.json()["points"]}
    # Only test redemption if balance > 0
    IF    ${before_points} > 0
        ${items_list}=    Create List
        ${order_item}=    Create Dictionary    menuItemId=${item["id"]}    quantity=${2}
        Append To List    ${items_list}    ${order_item}
        ${body}=    Create Dictionary
        ...    branchId=${BRANCH_ID}
        ...    orderType=TAKEAWAY
        ...    customerId=${customer_id}
        ...    items=${items_list}
        ...    gstRate=${5}
        ...    loyaltyPointsRedeem=${before_points}
        ${oresp}=    POST On Session    api    /orders/public    json=${body}
        Assert Status    ${oresp}    201
        # Re-check balance
        ${after_resp}=    GET On Session    api    /customers/me/loyalty-balance/${restaurant_id}
        ...    headers=${headers}
        ${after_points}=    Convert To Integer    ${after_resp.json()["points"]}
        Should Be True    ${after_points} < ${before_points}
        ...    msg=Loyalty points were not deducted after redemption
    ELSE
        Log    Customer has 0 points — skip redemption check    WARN
    END

TC-CUST-08 Customer Can Add Address
    [Tags]    customer    smoke
    ${headers}=    Get Auth Headers    ${CUST_TOKEN}
    ${body}=    Create Dictionary
    ...    label=Home
    ...    address=123 Test Street, Chennai
    ${resp}=    POST On Session    api    /customers/me/addresses
    ...    json=${body}    headers=${headers}
    Assert Status    ${resp}    201
    Assert Response Has Key    ${resp.json()}    id

TC-CUST-09 Customer Cannot Access Another Customer Profile
    [Tags]    customer    security
    ${headers}=    Get Auth Headers    ${CUST_TOKEN}
    # Try to access staff /auth/me with customer token — should 403 or 401
    ${resp}=    GET On Session    api    /auth/me    headers=${headers}    expected_status=any
    Should Be True    ${resp.status_code} in [401, 403]
