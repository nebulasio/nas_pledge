$(function () {
    $(".menu_item").on("click", function (ele) {
        action = $(this).attr("tag");
        $("#action_text").text($(this).text());
        _checkAction();
        _updateViewWithAction();
        hideAllError();
    });
});

var actions = ["stopPledge", "exportDataToNat", "transferAmount"];
var action = null;

function _generateCheck() {
    var r1 = unlock(),
        r2 = checkNonceAndGas(),
        r3 = _checkAction();
    let r = r1 && r2 && r3;
    if (action != null && parseInt(action) > 0) {
        let r4 = _validInput($("#nat_contract"));
        return r && r4;
    } else {
        return r;
    }

}

function _checkAction() {
    if (action == null) {
        setError($("#action_container"), "Please select the action to perform.");
        return false;
    }
    cancelError($("#action_container"));
    return true;
}

function _updateViewWithAction() {
    switch (parseInt(action)) {
        case 0:
            $("#nat_contract_container").hide();
            $("#nonce_container").removeClass("col-6").addClass("col-12");
            break;
        case 1:
        case 2:
            $("#nat_contract_container").show();
            $("#nonce_container").removeClass("col-12").addClass("col-6");
            break;
    }
}

function generate() {
    if (!_generateCheck()) {
        return;
    }
    let f = actions[parseInt(action)];
    let arg = "";
    if (parseInt(action) > 0) {
        arg = "\"" + $("#nat_contract").val() + "\"";
    }
    var nonce = $("#nonce2").val(),
        gasLimit = $("#gas_limit").val(),
        gasPrice = $("#gas_price2").val(),
        contract = {
            "source": "",
            "sourceType": "js",
            "function": f,
            "args": "[" + arg + "]",
            "binary": "",
            "type": "call"
        };

    try {
        var tx = new NebTransaction(parseInt(chainId), account, pledgeContract, "0", parseInt(nonce), gasPrice, gasLimit, contract);
        tx.signTransaction();
        $("#output").val(tx.toProtoString());
        didGenerate();
    } catch (e) {
        alert(e);
    }
}
