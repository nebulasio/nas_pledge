var nebulas = require("nebulas");
var NebAccount = nebulas.Account;
var NebUtils = nebulas.Utils;
var NebTransaction = nebulas.Transaction;
var NebUnit = nebulas.Unit;
var neb = new Neb();


// TODO:
// var chainId = 1;
// var explorerLink = "https://explorer.nebulas.io/#/tx/";
// neb.setRequest(new nebulas.HttpRequest("https://mainnet.nebulas.io"));
// TODO:
// var pledgeContract = "n1mBSJqcvPoiMeLFN9CFxmXsjDNB9bJhm1W";

var chainId = 1001;
var explorerLink = "https://explorer.nebulas.io/#/testnet/tx/";
neb.setRequest(new nebulas.HttpRequest("https://testnet.nebulas.io"));

var pledgeContract = "n1he2V7zqELAScrK9KhDkkxPhSf9g8vQ8aZ";

var fileName = null;
var keystore = null;
var account = null;
var accountState = {};

var showWaitingTime = 0;

function setError(input, msg) {
    input.popover({trigger: 'focus', content: msg});
    input.popover("show");
    input.addClass("input_error");
}

function cancelError(input) {
    input.popover('dispose');
    input.removeClass("input_error");
}

function showAllError() {
    $(".input_error").popover("show");
}

function hideAllError() {
    $(".input_error").popover("hide");
}

function showWaiting() {
    showWaitingTime = new Date().getTime();
    bootbox.dialog({message: "Waiting...", size: 'large', closeButton: false, buttons: {}});
}

function hideWaiting() {
    var now = new Date().getTime();
    var offset = Math.ceil((now - showWaitingTime));
    if (offset < 1000) {
        offset = 1000;
    }
    window.setTimeout(bootbox.hideAll, offset);
}

$(function () {
    $("#btn_get_info").on("click", getInfo);
    $("#btn_generate").on("click", generate);
    $("#btn_send").on("click", send);
    $("#btn_save").on("click", save);
    $("#file").on("change", onChangeFile);

    $("#pwd_container").hide();
    $("#information").hide();
    $("#balance_container").hide();
    $("#save_container").hide();
    $("#contract").val(pledgeContract);

    bootbox.setDefaults({
        className: "neb_boot_box"
    });

    $("textarea,input[type='text'],input[type='password']").on("input propertychange focus", function () {
        _validInput($(this));
    });

    $(function () {
        $('.dropdown-toggle').dropdown();
    });
});

function _validInput(input) {
    var valid = input.attr("valid");
    if (!valid) {
        return true;
    }
    var vs = valid.split(",");
    for (var i = 0; i < vs.length; ++i) {
        var v = vs[i];
        var array = v.split("|");
        var r = false;
        if (array.length > 1) {
            r = _valid(input, array[0], array[1]);
        } else {
            r = _valid(input, array[0], null);
        }
        if (!r) {
            return false;
        }
    }
    return true;
}

function _valid(input, method, msg) {
    if (method === "required") {
        if (input.val().length === 0) {
            setError(input, msg);
            return false;
        } else {
            cancelError(input);
        }
    } else if (method === "int") {
        if (!_isInt(input.val())) {
            setError(input, msg);
            return false;
        } else {
            cancelError(input);
        }
    } else if (method === "cycle") {
        if (!_isInt(input.val()) || parseInt(input.val()) < 1) {
            setError(input, msg);
            return false;
        } else {
            cancelError(input);
        }
    } else if (method === "amount") {
        var amount = input.val();
        var a = amount.split(".");
        var amountValid = a.length === 1 || a[1].length <= 18;
        amountValid = amountValid && _isFloat(amount);
        if (!amountValid) {
            if (!msg) {
                msg = "Please enter the correct amount of NAS.";
            }
            setError(input, msg);
            return false;
        } else {
            cancelError(input);
        }
    } else if (method === "pledgeAmount") {
        var amount = input.val();
        var valid = parseFloat(amount) >= 1;
        if (!valid) {
            if (!msg) {
                msg = "The amount cannot be less than 1NAS";
            }
            setError(input, msg);
            return false;
        } else {
            cancelError(input);
        }
    } else if (method === "address") {
        if (!NebAccount.isValidAddress(input.val())) {
            if (!msg) {
                msg = "Please enter the correct neb address";
            }
            setError(input, msg);
            return false;
        } else {
            cancelError(input);
        }
    }
    return true;
}

function _isInt(val) {
    return /^\d+$/.test(val);
}

function _isFloat(val) {
    return /^\d+(\.\d+)?$/.test(val);
}

function _unlockCheck() {
    if (!keystore) {
        setError($("#btn_keystore"), "Please select your wallet");
        return false;
    }
    cancelError($("#btn_keystore"));
    return _validInput($("#pwd"));
}

function _updateKeystoreText() {
    var s = "";
    if (fileName) {
        s += fileName;
    }
    if (account) {
        s += " (" + account.getAddressString() + ")";
    }
    $("#btn_keystore").text(s);
}

function _checkGetInfo() {
    return _validInput($("#from_address"));
}

function _checkSend() {
    return _validInput($("#output"));
}

function checkNonceAndGas() {
    var r1 = _validInput($("#nonce2")),
        r2 = _validInput($("#gas_price2")),
        r3 = _validInput($("#gas_limit"));
    return r1 && r2 && r3;
}

function getInfo() {
    if (!_checkGetInfo()) {
        return;
    }
    try {
        showWaiting();
        var address = $("#from_address").val();
        neb.api.gasPrice()
            .then(function (resp) {
                $("#gas_price1").val(resp.gas_price);
                $("#gas_price2").val(resp.gas_price);
                accountState.gasPrice = resp.gas_price;
                return neb.api.getAccountState(address);
            })
            .then(function (resp) {
                hideWaiting();
                accountState.balance = resp.balance;
                accountState.nonce = resp.nonce;
                $("#nonce1").val(parseInt(resp.nonce) + 1);
                $("#nonce2").val(parseInt(resp.nonce) + 1);
                var b = NebUtils.toBigNumber(resp.balance).mul(NebUtils.toBigNumber(10).pow(-18));
                $("#balance").val(b.toString(10));

                let f = function () {
                    $("#information").show();
                    $("#balance_container").show();
                };

                let stateView = $("#pledge_state");
                if (stateView.length > 0) {
                    getPledgeAmount(address, function (amount) {
                        hideAllError();
                        if (amount == null) {
                            return;
                        }
                        f();
                        stateView.val(amount === 0 ?
                            address + " have not pledge." :
                            address + " pledge " + amount + " NAS."
                        );
                    });
                } else {
                    f();
                    hideAllError();
                }
            })
            .catch(function (e) {
                hideWaiting();
                alert(e);
            });
    } catch (e) {
        alert(e);
    }
}

function onChangeFile(e) {
    var file = e.target.files[0],
        fr = new FileReader();

    fr.onload = onload;
    fr.readAsText(file);

    function onload(e) {
        try {
            keystore = JSON.parse(e.target.result);
            fileName = file.name;
            _updateKeystoreText();
            cancelError($("#btn_keystore"));
            hideAllError();
            $("#pwd_container").show();
        } catch (ex) {
            alert(ex.message);
        }
    }
}

function unlock() {
    if (!_unlockCheck()) {
        return false;
    }
    try {
        var pwd = $("#pwd").val();
        account = NebAccount.fromAddress(keystore.address);
        account.fromKey(keystore, pwd);
        _updateKeystoreText();
        return true;
    } catch (e) {
        account = null;
        alert(e);
        return false;
    }
}

function didGenerate() {
    $("#send_container").removeClass("col-12").addClass("col-6");
    $("#save_container").show();
}

function send() {
    if (!_checkSend()) {
        return;
    }
    showWaiting();
    neb.api.sendRawTransaction($("#output").val()).then(function (resp) {
        hideWaiting();
        if (resp.error) {
            $("#result").text(resp.error);
        } else {
            $("#result").text("Explorer link:");
        }
        var link = explorerLink + resp.txhash;
        $("#hash").attr("href", link);
        $("#hash").text(link);
        $("#hash").show();

        $([document.documentElement, document.body]).animate({
            scrollTop: document.body.scrollHeight
        }, 1000);
    }).catch(function (o) {
        hideWaiting();
        alert(o);
    });
}

function save() {
    if (!_checkSend()) {
        return;
    }
    blob = new Blob([$("#output").val()], {type: "application/text; charset=utf-8"});
    saveAs(blob, "raw_transaction.txt");
}
