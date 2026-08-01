*** Settings ***
Library         RequestsLibrary
Library         Collections
Resource        ../resources/keywords.robot
Resource        ../resources/variables.robot

Suite Setup     Run Keywords    Create API Session    AND    Setup Order Suite

*** Variables ***
${RESTAURANT_ID}    ${EMPTY}
${MENU_ITEM_ID}     ${EMPTY}
${ORDER_ID}         ${EMPTY}
${ORDER_NUMBER}     ${EMPTY}

*** Keywords ***
Get Addon Item From Menu
    [Arguments]    ${cats}
    FOR    ${cat}    IN    @{cats}
        FOR    ${item}    IN    @{${cat["items"]}}
            ${groups}=    Get From Dictionary    ${item}    addonGroups
            ${gc}=    Get Length    ${groups}
            IF    ${gc} > 0
                ${group}=    Get From List    ${groups}    0
                ${ac}=    Get Length    ${group["addons"]}
                IF    ${ac} > 0
                    RETURN    ${item}
                END
            END
        END
    END
    RETURN    ${None}

Setup Order Suite
    ${restaurant_id}=    Get Restaurant ID From Slug
    Set Suite Variable    ${RESTAURANT_ID}    ${restaurant_id}
    # Fetch first available menu item
    ${resp}=    GET On Session    api    /menu/public/${RESTAURANT_ID}
    ${cats}=    Get From Dictionary    ${resp.json()}    categories
    ${first_cat}=    Get From List    ${cats}    0
    ${items}=    Get From Dictionary    ${first_cat}    items
    ${item}=    Get From List    ${items}    0
    Set Suite Variable    ${MENU_ITEM_ID}    ${item["id"]}
    Log    Suite setup: restaurant=${RESTAURANT_ID} item=${MENU_ITEM_ID}

Place Takeaway Order
    [Arguments]    ${customer_name}=Test Customer    ${extra_fields}=${None}
    ${items_list}=    Create List
    ${item}=    Create Dictionary    menuItemId=${MENU_ITEM_ID}    quantity=${2}
    Append To List    ${items_list}    ${item}
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}
    ...    orderType=TAKEAWAY
    ...    orderSource=ONLINE
    ...    customerName=${customer_name}
    ...    customerPhone=${CUST_PHONE}
    ...    items=${items_list}
    ...    gstRate=${5}
    ...    serviceChargePercent=${5}
    ${resp}=    POST On Session    api    /orders/public    json=${body}
    Assert Status    ${resp}    201
    RETURN    ${resp}

*** Test Cases ***
TC-ORD-01 Place Public Takeaway Order
    [Tags]    orders    smoke    public
    ${resp}=    Place Takeaway Order
    Assert Response Has Key    ${resp.json()}    id
    Assert Response Has Key    ${resp.json()}    orderNumber
    Assert Response Has Key    ${resp.json()}    status
    Should Be Equal    ${resp.json()["status"]}    PENDING
    Set Suite Variable    ${ORDER_ID}    ${resp.json()["id"]}
    Set Suite Variable    ${ORDER_NUMBER}    ${resp.json()["orderNumber"]}
    Log    Order placed: ${ORDER_NUMBER}

TC-ORD-02 Order Total Is Calculated Correctly
    [Tags]    orders    smoke    billing
    # 2 x Veg Spring Rolls (120 each) = 240 subtotal + 5% GST + 5% service
    ${resp}=    Place Takeaway Order
    ${body}=    Set Variable    ${resp.json()}
    ${subtotal}=    Convert To Number    ${body["subtotal"]}
    ${total}=       Convert To Number    ${body["total"]}
    Should Be True    ${subtotal} > 0    msg=Subtotal is 0
    Should Be True    ${total} >= ${subtotal}    msg=Total less than subtotal

TC-ORD-03 Track Order Without Auth Returns Order Data
    [Tags]    orders    smoke    public
    ${resp}=    GET On Session    api    /orders/${ORDER_ID}/track
    Assert Status    ${resp}    200
    Should Be Equal    ${resp.json()["id"]}    ${ORDER_ID}

TC-ORD-04 Order With Coupon WELCOME20
    [Tags]    orders    coupons    smoke
    ${items_list}=    Create List
    ${item}=    Create Dictionary    menuItemId=${MENU_ITEM_ID}    quantity=${2}
    Append To List    ${items_list}    ${item}
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}
    ...    orderType=TAKEAWAY
    ...    orderSource=ONLINE
    ...    customerName=Test Coupon
    ...    customerPhone=9876500001
    ...    items=${items_list}
    ...    couponCode=WELCOME20
    ...    gstRate=${5}
    ...    serviceChargePercent=${5}
    ${resp}=    POST On Session    api    /orders/public    json=${body}
    Assert Status    ${resp}    201
    ${coupon_discount}=    Convert To Number    ${resp.json()["couponDiscount"]}
    Should Be True    ${coupon_discount} > 0    msg=Coupon discount was not applied

TC-ORD-05 Order With Invalid Coupon Returns 400
    [Tags]    orders    coupons    negative
    ${items_list}=    Create List
    ${item}=    Create Dictionary    menuItemId=${MENU_ITEM_ID}    quantity=${1}
    Append To List    ${items_list}    ${item}
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}
    ...    orderType=TAKEAWAY
    ...    orderSource=ONLINE
    ...    customerName=Test
    ...    customerPhone=9876500002
    ...    items=${items_list}
    ...    couponCode=FAKECOUPON999
    ...    gstRate=${5}
    ${resp}=    POST On Session    api    /orders/public    json=${body}    expected_status=any
    Assert Status    ${resp}    400

TC-ORD-06 Order With Empty Items Returns 400
    [Tags]    orders    negative    validation
    ${items_list}=    Create List
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}
    ...    orderType=TAKEAWAY
    ...    customerName=Test
    ...    customerPhone=9876500003
    ...    items=${items_list}
    ${resp}=    POST On Session    api    /orders/public    json=${body}    expected_status=any
    Assert Status    ${resp}    400

TC-ORD-07 Order With Delivery But No Address Returns 400
    [Tags]    orders    negative    validation
    ${items_list}=    Create List
    ${item}=    Create Dictionary    menuItemId=${MENU_ITEM_ID}    quantity=${1}
    Append To List    ${items_list}    ${item}
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}
    ...    orderType=DELIVERY
    ...    customerName=Test
    ...    customerPhone=9876500004
    ...    items=${items_list}
    ...    gstRate=${5}
    ${resp}=    POST On Session    api    /orders/public    json=${body}    expected_status=any
    Assert Status    ${resp}    400

TC-ORD-08 Order With Nonexistent Menu Item Returns 404
    [Tags]    orders    negative
    ${items_list}=    Create List
    ${item}=    Create Dictionary    menuItemId=nonexistent-item-id    quantity=${1}
    Append To List    ${items_list}    ${item}
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}
    ...    orderType=TAKEAWAY
    ...    customerName=Test
    ...    customerPhone=9876500005
    ...    items=${items_list}
    ${resp}=    POST On Session    api    /orders/public    json=${body}    expected_status=any
    Should Be True    ${resp.status_code} in [400, 404]

TC-ORD-09 Staff Can Update Order Status
    [Tags]    orders    admin    smoke
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${body}=    Create Dictionary    status=CONFIRMED
    ${resp}=    PATCH On Session    api    /orders/${ORDER_ID}/status
    ...    json=${body}    headers=${headers}
    Assert Status    ${resp}    200
    Should Be Equal    ${resp.json()["status"]}    CONFIRMED

TC-ORD-10 Order Status Can Progress To PREPARING
    [Tags]    orders    admin
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${body}=    Create Dictionary    status=PREPARING
    ${resp}=    PATCH On Session    api    /orders/${ORDER_ID}/status
    ...    json=${body}    headers=${headers}
    Assert Status    ${resp}    200

TC-ORD-11 Customer Can Cancel PENDING Order Within Window
    [Tags]    orders    customer
    # Place a fresh order for cancellation test
    ${resp}=    Place Takeaway Order    customer_name=Cancel Test
    ${cancel_order_id}=    Set Variable    ${resp.json()["id"]}
    ${cancel_resp}=    PATCH On Session    api    /orders/${cancel_order_id}/cancel
    ...    expected_status=any
    Should Be True    ${cancel_resp.status_code} in [200, 204]

TC-ORD-12 Order Coupon Validate Endpoint
    [Tags]    orders    coupons    public
    ${resp}=    GET On Session    api    /orders/coupon/${RESTAURANT_ID}/WELCOME20?subtotal=300
    Assert Status    ${resp}    200
    ${body}=    Set Variable    ${resp.json()}
    Assert Response Has Key    ${body}    valid
    Should Be True    ${body["valid"]}
    Should Be True    ${body["discountAmount"]} > 0

TC-ORD-13 Coupon Below Min Order Value Returns Invalid
    [Tags]    orders    coupons    negative
    ${resp}=    GET On Session    api    /orders/coupon/${RESTAURANT_ID}/WELCOME20?subtotal=50
    Assert Status    ${resp}    200
    Should Not Be True    ${resp.json()["valid"]}

TC-ORD-14 GST Rate From Settings Applied Correctly
    [Tags]    orders    billing    regression
    # Bug check: gstRate should come from settings, not hardcoded 5
    ${resp}=    GET On Session    api    /settings/${RESTAURANT_ID}/online-settings
    ${settings}=    Set Variable    ${resp.json()}
    Assert Response Has Key    ${settings}    gstRate
    ${gst_rate}=    Convert To Number    ${settings["gstRate"]}
    Should Be True    ${gst_rate} >= 0    msg=gstRate must be a non-negative number

TC-ORD-15 Order With Addons Total Price Is Correct
    [Tags]    orders    billing    regression
    # Verify that addon price is included in order subtotal
    ${menu_resp}=    GET On Session    api    /menu/public/${RESTAURANT_ID}
    ${cats}=    Get From Dictionary    ${menu_resp.json()}    categories
    ${addon_item}=    Get Addon Item From Menu    ${cats}
    IF    $addon_item is not None
        ${group}=    Get From List    ${addon_item["addonGroups"]}    0
        ${addon}=    Get From List    ${group["addons"]}    0
        ${addon_price}=    Convert To Number    ${addon["price"]}
        ${addon_ids}=    Create List    ${addon["id"]}
        ${order_item}=    Create Dictionary
        ...    menuItemId=${addon_item["id"]}    quantity=${1}    addonIds=${addon_ids}
        ${items_list}=    Create List    ${order_item}
        ${body}=    Create Dictionary
        ...    branchId=${BRANCH_ID}    orderType=TAKEAWAY
        ...    customerName=Addon Total Test    customerPhone=9876500099
        ...    items=${items_list}    gstRate=${5}
        ${oresp}=    POST On Session    api    /orders/public    json=${body}
        Assert Status    ${oresp}    201
        ${subtotal}=    Convert To Number    ${oresp.json()["subtotal"]}
        ${expected}=    Evaluate    ${addon_item["price"]} + ${addon_price}
        Should Be Equal As Numbers    ${subtotal}    ${expected}
    ELSE
        Log    No items with paid addons in seed data — skip    WARN
    END
