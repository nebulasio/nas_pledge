$(function () {
    $("#nano_contract").val(pledgeContract);
    $("#btn_nano_generate").on("click", genCode);

    var li = $(".nav li a").get(0);
    li.click();

    $("#myTab a").click(function (e) {
        e.preventDefault();
        hideAllError();
    });

    $("#btn_nano_get_info").click(function (e) {
        if (!_validInput($("#nano_from_address"))) {
            return;
        }
        _queryPledgeState();
    });

    $(".menu_item").on("click", function (ele) {
        var a = parseInt($(this).attr("tag"));
        var t = $(this).attr("target");
        if (t.indexOf("nano") === 0) {
            nanoAction = a;
            $("#nano_action_text").text($(this).text());
            _updateViewWithAction($("#nano_amount_container"), nanoAction);
        } else {
            action = a;
            $("#action_text").text($(this).text());
            _updateViewWithAction($("#amount_container"), action);
        }
        hideAllError();
    })
});

var actions = ["pledge", "cancelPledge"];
var action = 0;
var nanoAction = 0;

function _updateViewWithAction(amountContainer, action) {
    switch (parseInt(action)) {
        case 0:
            amountContainer.show();
            break;
        case 1:
            amountContainer.hide();
            break;
    }
}

function _generateCheck() {
    var r1 = unlock(),
        r2 = checkNonceAndGas();
    var r3 = true;
    if (action === 0) {
        r3 = _validInput($("#amount"));
    }
    return r1 && r2 && r3;
}

function _generateCodeCheck() {
    if (nanoAction === 0) {
        return _validInput($("#nano_amount"));
    }
    return true;
}

function _queryPledgeState() {
    var a = $("#nano_from_address").val();
    showWaiting();
    getPledgeAmount(a, function (amount) {
        hideWaiting();
        if (amount == null) {
            return;
        }
        $("#nano_pledge_state").val(amount === 0 ?
            a + " have not pledge." :
            a + " pledge " + amount + " NAS."
        );
    });
}

function getPledgeAmount(address, callback) {
    try {
        neb.api.call({
            from: address,
            to: pledgeContract,
            value: 0,
            nonce: 0,
            gasPrice: 1000000,
            gasLimit: 200000,
            contract: {
                "source": "",
                "sourceType": "js",
                "function": "getPledgeWithAddress",
                "args": "[\"" + address + "\"]",
                "binary": "",
                "type": "call"
            }
        }).then(function (r) {
            if (r.error) {
                alert(error);
                callback(null);
            } else {
                let p = JSON.parse(r.result);
                if (p && !p.c) {
                    callback(p.v);
                } else {
                    callback(0);
                }
            }
        }).catch(function (e) {
            alert(e);
            callback(null);
        });
    } catch (e) {
        alert(e);
        callback(null);
    }
}

function genCode() {
    if (!_generateCodeCheck()) {
        return;
    }
    var value = "0";
    if (nanoAction === 0) {
        value = NebUnit.nasToBasic($("#nano_amount").val());
    }
    var params = {
        "pageParams": {
            "pay": {
                "currency": "NAS",
                "value": value,
                "to": pledgeContract,
                "payload": {
                    "function": actions[nanoAction],
                    "args": "[]",
                    "type": "call"
                }
            }
        },
        "des": "confirmTransfer",
        "category": "jump"
    };
    var str = JSON.stringify(params);
    $("#code").empty();
    $("#code").qrcode({
        background: "#ffffff00",//背景颜色
        foreground: "#000000", //前景颜色
        width: 300,
        height: 300,
        text: str
    });
    $("#code_container").show();
}

function generate() {
    if (!_generateCheck()) {
        return;
    }
    var nonce = $("#nonce2").val(),
        gaslimit = $("#gas_limit").val(),
        gasprice = $("#gas_price2").val(),
        contract = {
            "source": "",
            "sourceType": "js",
            "function": actions[action],
            "args": "[]",
            "binary": "",
            "type": "call"
        };

    try {
        var value = "0";
        if (action === 0) {
            value = NebUnit.nasToBasic($("#amount").val());
        }
        var tx = new NebTransaction(parseInt(chainId), account, pledgeContract, value, parseInt(nonce), gasprice, gaslimit, contract);
        tx.signTransaction();
        $("#output").val(tx.toProtoString());
        didGenerate();
    } catch (e) {
        alert(e);
    }
}
