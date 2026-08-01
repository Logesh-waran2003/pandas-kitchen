*** Settings ***
Library         RequestsLibrary
Library         Collections
Resource        ../resources/keywords.robot
Resource        ../resources/variables.robot

Suite Setup     Create API Session

*** Variables ***
${RESTAURANT_ID}    ${EMPTY}

*** Test Cases ***
TC-MENU-01 Public Menu Returns Categories And Items
    [Tags]    menu    smoke    public
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /menu/public/${restaurant_id}
    Assert Status    ${resp}    200
    ${body}=    Set Variable    ${resp.json()}
    Assert Response Has Key    ${body}    categories
    ${cats}=    Get From Dictionary    ${body}    categories
    Should Not Be Empty    ${cats}    msg=Menu has no categories
    Log    Categories: ${cats.__len__()} found

TC-MENU-02 Public Menu Items Have Required Fields
    [Tags]    menu    smoke    public
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /menu/public/${restaurant_id}
    ${cats}=    Get From Dictionary    ${resp.json()}    categories
    ${first_cat}=    Get From List    ${cats}    0
    ${items}=    Get From Dictionary    ${first_cat}    items
    Should Not Be Empty    ${items}    msg=First category has no items
    ${item}=    Get From List    ${items}    0
    Assert Response Has Key    ${item}    id
    Assert Response Has Key    ${item}    name
    Assert Response Has Key    ${item}    price
    Assert Response Has Key    ${item}    isVeg
    Assert Response Has Key    ${item}    addonGroups

TC-MENU-03 Addon Groups Expose minSelect maxSelect isRequired
    [Tags]    menu    smoke    public    regression
    # Bug check: minSelect/maxSelect/isRequired must be in public response after our fix
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /menu/public/${restaurant_id}
    ${cats}=    Get From Dictionary    ${resp.json()}    categories
    FOR    ${cat}    IN    @{cats}
        ${items}=    Get From Dictionary    ${cat}    items
        FOR    ${item}    IN    @{items}
            ${groups}=    Get From Dictionary    ${item}    addonGroups
            FOR    ${group}    IN    @{groups}
                Assert Response Has Key    ${group}    minSelect
                Assert Response Has Key    ${group}    maxSelect
                Assert Response Has Key    ${group}    isRequired
                Log    Addon group OK: ${group["name"]}
            END
        END
    END

TC-MENU-04 Public Menu By Unknown Restaurant Returns 404
    [Tags]    menu    negative
    ${resp}=    GET On Session    api    /menu/public/nonexistent-id-xyz    expected_status=any
    Assert Status    ${resp}    404

TC-MENU-05 Staff Can Create Menu Category
    [Tags]    menu    admin
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${restaurant_id}=    Get Restaurant ID    ${token}
    ${body}=    Create Dictionary    restaurantId=${restaurant_id}    name=Test Category RF
    ${resp}=    POST On Session    api    /menu/categories    json=${body}    headers=${headers}
    Assert Status    ${resp}    201
    Assert Response Has Key    ${resp.json()}    id
    Set Suite Variable    ${CREATED_CATEGORY_ID}    ${resp.json()["id"]}

TC-MENU-06 Staff Can Create Menu Item
    [Tags]    menu    admin
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${restaurant_id}=    Get Restaurant ID    ${token}
    ${body}=    Create Dictionary
    ...    restaurantId=${restaurant_id}
    ...    categoryId=${CREATED_CATEGORY_ID}
    ...    name=Test Item RF
    ...    price=${150}
    ...    isVeg=${True}
    ${resp}=    POST On Session    api    /menu/items    json=${body}    headers=${headers}
    Assert Status    ${resp}    201
    Assert Response Has Key    ${resp.json()}    id
    Set Suite Variable    ${CREATED_ITEM_ID}    ${resp.json()["id"]}

TC-MENU-07 Staff Can Toggle Item Availability
    [Tags]    menu    admin
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${resp}=    PATCH On Session    api    /menu/items/${CREATED_ITEM_ID}/toggle
    ...    headers=${headers}    expected_status=any
    Should Be True    ${resp.status_code} in [200, 204]

TC-MENU-08 Staff Can Create Addon Group And Addons
    [Tags]    menu    admin
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${restaurant_id}=    Get Restaurant ID    ${token}
    # Create addon group
    ${group_body}=    Create Dictionary
    ...    restaurantId=${restaurant_id}
    ...    name=Test Sauce
    ...    minSelect=${0}
    ...    maxSelect=${2}
    ...    isRequired=${False}
    ${gresp}=    POST On Session    api    /menu/addon-groups    json=${group_body}    headers=${headers}
    Assert Status    ${gresp}    201
    ${group_id}=    Set Variable    ${gresp.json()["id"]}
    # Create addon
    ${addon_body}=    Create Dictionary    name=Extra Sauce    price=${20}
    ${aresp}=    POST On Session    api    /menu/addon-groups/${group_id}/addons
    ...    json=${addon_body}    headers=${headers}
    Assert Status    ${aresp}    201
    Assert Response Has Key    ${aresp.json()}    id
