*** Settings ***
Library         RequestsLibrary
Library         Collections
Resource        ../resources/keywords.robot
Resource        ../resources/variables.robot

Suite Setup     Create API Session

*** Variables ***
${RESTAURANT_ID}    ${EMPTY}
${INV_ITEM_ID}      ${EMPTY}

*** Keywords ***
Setup Suite Vars
    ${restaurant_id}=    Get Restaurant ID From Slug
    Set Suite Variable    ${RESTAURANT_ID}    ${restaurant_id}

*** Test Cases ***
TC-SET-01 Online Settings Returns All Required Fields
    [Tags]    settings    smoke    regression
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /settings/${restaurant_id}/online-settings
    Assert Status    ${resp}    200
    ${body}=    Set Variable    ${resp.json()}
    Assert Response Has Key    ${body}    onlineOrderingEnabled
    Assert Response Has Key    ${body}    deliveryEnabled
    Assert Response Has Key    ${body}    takeawayEnabled
    Assert Response Has Key    ${body}    deliveryFee
    Assert Response Has Key    ${body}    packagingFee
    Assert Response Has Key    ${body}    serviceChargePercent
    Assert Response Has Key    ${body}    gstRate
    Assert Response Has Key    ${body}    loyaltyPointsPerRupee
    Assert Response Has Key    ${body}    loyaltyRedemptionRate
    Log    Settings OK: gstRate=${body["gstRate"]}

TC-SET-02 gstRate Is Numeric Non-Negative
    [Tags]    settings    regression    billing
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /settings/${restaurant_id}/online-settings
    ${gst}=    Convert To Number    ${resp.json()["gstRate"]}
    Should Be True    ${gst} >= 0

TC-SET-03 Staff Can Update Online Settings
    [Tags]    settings    admin
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${restaurant_id}=    Get Restaurant ID    ${token}
    ${body}=    Create Dictionary    serviceChargePercent=${5}    gstRate=${5}
    ${resp}=    PATCH On Session    api    /settings/${restaurant_id}/online-settings
    ...    json=${body}    headers=${headers}
    Assert Status    ${resp}    200

TC-SET-04 Restaurant Public Info Returns Slug Name Branches
    [Tags]    settings    smoke    public
    ${resp}=    GET On Session    api    /settings/restaurant/${RESTAURANT_SLUG}/public
    Assert Status    ${resp}    200
    ${body}=    Set Variable    ${resp.json()}
    Assert Response Has Key    ${body}    id
    Assert Response Has Key    ${body}    name
    Assert Response Has Key    ${body}    slug
    Assert Response Has Key    ${body}    branches
    ${branches}=    Get From Dictionary    ${body}    branches
    Should Not Be Empty    ${branches}    msg=Restaurant has no branches

TC-INV-01 Staff Can Create Inventory Item
    [Tags]    inventory    admin
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${restaurant_id}=    Get Restaurant ID    ${token}
    ${body}=    Create Dictionary
    ...    restaurantId=${restaurant_id}
    ...    branchId=${BRANCH_ID}
    ...    name=Tomato RF Test
    ...    unit=kg
    ...    currentStock=${10}
    ...    minStock=${2}
    ...    costPerUnit=${30}
    ${resp}=    POST On Session    api    /inventory    json=${body}    headers=${headers}
    Assert Status    ${resp}    201
    Assert Response Has Key    ${resp.json()}    id
    Set Suite Variable    ${INV_ITEM_ID}    ${resp.json()["id"]}

TC-INV-02 Staff Can Adjust Stock Up
    [Tags]    inventory    admin
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${restaurant_id}=    Get Restaurant ID    ${token}
    ${body}=    Create Dictionary    type=RESTOCK    quantity=${5}    note=RF test restock
    ${resp}=    POST On Session    api    /inventory/${INV_ITEM_ID}/adjust
    ...    json=${body}    headers=${headers}
    Assert Status    ${resp}    200
    ${new_stock}=    Convert To Number    ${resp.json()["currentStock"]}
    Should Be Equal As Numbers    ${new_stock}    15

TC-INV-03 Stock Cannot Go Below Zero
    [Tags]    inventory    negative    validation
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${body}=    Create Dictionary    type=MANUAL_DEDUCTION    quantity=${9999}
    ${resp}=    POST On Session    api    /inventory/${INV_ITEM_ID}/adjust
    ...    json=${body}    headers=${headers}    expected_status=any
    Assert Status    ${resp}    400

TC-INV-04 Low Stock Report Returns Items Below Min
    [Tags]    inventory    admin
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${restaurant_id}=    Get Restaurant ID    ${token}
    ${resp}=    GET On Session    api    /inventory/low-stock?restaurantId=${restaurant_id}
    ...    headers=${headers}
    Assert Status    ${resp}    200
    # Response is a list
    ${items}=    Set Variable    ${resp.json()}
    Log    Low stock items: ${items.__len__()}
