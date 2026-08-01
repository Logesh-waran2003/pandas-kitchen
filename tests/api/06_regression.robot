*** Settings ***
Library         RequestsLibrary
Library         Collections
Resource        ../resources/keywords.robot
Resource        ../resources/variables.robot

Suite Setup     Create API Session

*** Variables ***
${RESTAURANT_ID}    ${EMPTY}

*** Test Cases ***
TC-REG-01 Public Menu addonGroups Has minSelect maxSelect isRequired
    [Tags]    regression    menu    critical
    # Verifies the fix: public API was stripping these fields before
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /menu/public/${restaurant_id}
    Assert Status    ${resp}    200
    ${cats}=    Get From Dictionary    ${resp.json()}    categories
    FOR    ${cat}    IN    @{cats}
        ${items}=    Get From Dictionary    ${cat}    items
        FOR    ${item}    IN    @{items}
            ${groups}=    Get From Dictionary    ${item}    addonGroups
            FOR    ${group}    IN    @{groups}
                Run Keyword And Continue On Failure
                ...    Dictionary Should Contain Key    ${group}    minSelect
                Run Keyword And Continue On Failure
                ...    Dictionary Should Contain Key    ${group}    maxSelect
                Run Keyword And Continue On Failure
                ...    Dictionary Should Contain Key    ${group}    isRequired
            END
        END
    END

TC-REG-02 Online Settings Has gstRate Field
    [Tags]    regression    settings    billing    critical
    # Verifies the fix: gstRate was missing from online settings response
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /settings/${restaurant_id}/online-settings
    Assert Status    ${resp}    200
    Dictionary Should Contain Key    ${resp.json()}    gstRate
    ${gst}=    Convert To Number    ${resp.json()["gstRate"]}
    Should Be True    ${gst} >= 0

TC-REG-03 Online Settings Has loyaltyRedemptionRate And loyaltyPointsPerRupee
    [Tags]    regression    settings    loyalty
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /settings/${restaurant_id}/online-settings
    Dictionary Should Contain Key    ${resp.json()}    loyaltyRedemptionRate
    Dictionary Should Contain Key    ${resp.json()}    loyaltyPointsPerRupee

TC-REG-04 Order With loyaltyPointsRedeem=0 Does Not Crash
    [Tags]    regression    orders    loyalty
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /menu/public/${restaurant_id}
    ${item}=    Get From Dictionary    ${resp.json()["categories"][0]["items"][0]}    id
    ${items_list}=    Create List
    ${order_item}=    Create Dictionary    menuItemId=${item}    quantity=${1}
    Append To List    ${items_list}    ${order_item}
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}
    ...    orderType=TAKEAWAY
    ...    customerName=Loyalty Zero Test
    ...    customerPhone=9800077001
    ...    items=${items_list}
    ...    gstRate=${5}
    ...    loyaltyPointsRedeem=${0}
    ${resp}=    POST On Session    api    /orders/public    json=${body}
    Assert Status    ${resp}    201

TC-REG-05 Cart Key Dedup — Same Item Different Addons Are Separate Cart Rows
    [Tags]    regression    cart    api
    # Two order items for same menu item but different addonIds = 2 line items in DB
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${menu_resp}=    GET On Session    api    /menu/public/${restaurant_id}
    ${cats}=    Get From Dictionary    ${menu_resp.json()}    categories
    ${found}=    Set Variable    ${False}
    FOR    ${cat}    IN    @{cats}
        FOR    ${item}    IN    @{${cat["items"]}}
            ${groups}=    Get From Dictionary    ${item}    addonGroups
            IF    len($groups) > 0
                ${group}=    Get From List    ${groups}    0
                ${addons}=    Get From Dictionary    ${group}    addons
                IF    len($addons) >= 2
                    ${a1_id}=    Set Variable    ${addons[0]["id"]}
                    ${a2_id}=    Set Variable    ${addons[1]["id"]}
                    ${item_id}=    Set Variable    ${item["id"]}
                    ${ids1}=    Create List    ${a1_id}
                    ${ids2}=    Create List    ${a2_id}
                    ${oi1}=    Create Dictionary    menuItemId=${item_id}    quantity=${1}    addonIds=${ids1}
                    ${oi2}=    Create Dictionary    menuItemId=${item_id}    quantity=${1}    addonIds=${ids2}
                    ${items_both}=    Create List    ${oi1}    ${oi2}
                    ${body}=    Create Dictionary
                    ...    branchId=${BRANCH_ID}    orderType=TAKEAWAY
                    ...    customerName=Dedup Test    customerPhone=9800077002
                    ...    items=${items_both}    gstRate=${5}
                    ${oresp}=    POST On Session    api    /orders/public    json=${body}
                    Assert Status    ${oresp}    201
                    ${line_items}=    Get From Dictionary    ${oresp.json()}    items
                    ${li_count}=    Get Length    ${line_items}
                    Should Be Equal As Integers    ${li_count}    2
                    ...    msg=Expected 2 separate line items for different addons, got ${li_count}
                    ${found}=    Set Variable    ${True}
                    Exit For Loop
                END
            END
        END
        IF    $found    Exit For Loop
    END
    IF    not $found    Log    No items with 2+ addons in seed — skipping dedup check    WARN

TC-REG-06 Coupon Discount Reflected In Order Total
    [Tags]    regression    billing    coupons
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /menu/public/${restaurant_id}
    ${item_id}=    Set Variable    ${resp.json()["categories"][0]["items"][0]["id"]}
    ${item_price}=    Set Variable    ${resp.json()["categories"][0]["items"][0]["price"]}
    ${items_list}=    Create List
    ${oi}=    Create Dictionary    menuItemId=${item_id}    quantity=${2}
    Append To List    ${items_list}    ${oi}
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}    orderType=TAKEAWAY
    ...    customerName=Coupon Total Test    customerPhone=9800077003
    ...    items=${items_list}    couponCode=WELCOME20    gstRate=${5}
    ${oresp}=    POST On Session    api    /orders/public    json=${body}
    Assert Status    ${oresp}    201
    ${order}=    Set Variable    ${oresp.json()}
    ${subtotal}=    Convert To Number    ${order["subtotal"]}
    ${coupon_disc}=    Convert To Number    ${order["couponDiscount"]}
    ${total}=    Convert To Number    ${order["total"]}
    Should Be True    ${coupon_disc} > 0    msg=Coupon discount not applied
    ${expected_max_total}=    Evaluate    ${subtotal} - ${coupon_disc}
    Should Be True    ${total} <= ${subtotal}    msg=Total must be less than subtotal when coupon applied

TC-REG-07 Delivery Order Requires Address — Returns 400 Without It
    [Tags]    regression    validation    orders
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /menu/public/${restaurant_id}
    ${item_id}=    Set Variable    ${resp.json()["categories"][0]["items"][0]["id"]}
    ${items_list}=    Create List
    ${oi}=    Create Dictionary    menuItemId=${item_id}    quantity=${1}
    Append To List    ${items_list}    ${oi}
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}    orderType=DELIVERY
    ...    customerName=Delivery No Addr    customerPhone=9800077004
    ...    items=${items_list}    gstRate=${5}
    ${resp}=    POST On Session    api    /orders/public    json=${body}    expected_status=any
    Assert Status    ${resp}    400

TC-REG-08 Staff Cannot Access Another Restaurant Orders
    [Tags]    regression    security    rbac
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    # Try to list orders for a fake restaurant ID
    ${resp}=    GET On Session    api    /orders?restaurantId=fake-restaurant-id-xyz
    ...    headers=${headers}    expected_status=any
    # Should return empty list or 403, never leak data
    IF    ${resp.status_code} == 200
        ${orders}=    Get From Dictionary    ${resp.json()}    data
        ${count}=    Get Length    ${orders}
        Should Be Equal As Integers    ${count}    0
        ...    msg=Staff can see orders of other restaurants — SECURITY BUG
    ELSE
        Should Be True    ${resp.status_code} in [403, 404]
    END

TC-REG-09 Rate Limiter Does Not Block Normal API Use
    [Tags]    regression    performance
    # 10 rapid requests should all succeed (rate limit is 100/min)
    ${restaurant_id}=    Get Restaurant ID From Slug
    FOR    ${i}    IN RANGE    10
        ${resp}=    GET On Session    api    /settings/restaurant/${RESTAURANT_SLUG}/public
        Assert Status    ${resp}    200
    END

TC-REG-10 Pickup Code Generated For TAKEAWAY Orders
    [Tags]    regression    orders
    ${restaurant_id}=    Get Restaurant ID From Slug
    ${resp}=    GET On Session    api    /menu/public/${restaurant_id}
    ${item_id}=    Set Variable    ${resp.json()["categories"][0]["items"][0]["id"]}
    ${items_list}=    Create List
    ${oi}=    Create Dictionary    menuItemId=${item_id}    quantity=${1}
    Append To List    ${items_list}    ${oi}
    ${body}=    Create Dictionary
    ...    branchId=${BRANCH_ID}    orderType=TAKEAWAY
    ...    customerName=Pickup Code Test    customerPhone=9800077005
    ...    items=${items_list}    gstRate=${5}
    ${oresp}=    POST On Session    api    /orders/public    json=${body}
    Assert Status    ${oresp}    201
    # Confirm the order to trigger pickup code
    ${token}=    Staff Login And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${status_body}=    Create Dictionary    status=CONFIRMED
    ${sresp}=    PATCH On Session    api    /orders/${oresp.json()["id"]}/status
    ...    json=${status_body}    headers=${headers}
    Assert Status    ${sresp}    200
    # Track should show pickupCode
    ${track}=    GET On Session    api    /orders/${oresp.json()["id"]}/track
    Assert Response Has Key    ${track.json()}    pickupCode
    ${code}=    Get From Dictionary    ${track.json()}    pickupCode
    Should Not Be Empty    ${code}    msg=Pickup code is empty after CONFIRMED
