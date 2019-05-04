function PageList(storage, key) {
    this._storage = storage;
    this._key = key;
    this._pageIndexes = null;
    this._pageSize = 1000;
}

PageList.prototype = {

    _indexesKey: function () {
        return "pis_" + this._key;
    },

    _dataKey: function (index) {
        return "pd_" + this._key + "_" + index;
    },

    _lastIndex: function () {
        let indexes = this.getPageIndexes();
        if (indexes.length > 0) {
            return indexes[indexes.length - 1];
        }
        return null;
    },

    _addIndex: function (index) {
        this.getPageIndexes().push(index);
        this._saveIndexes();
    },

    _saveIndexes: function () {
        this._storage.put(this._indexesKey(), this.getPageIndexes());
    },

    getPageIndexes: function () {
        if (!this._pageIndexes) {
            this._pageIndexes = this._storage.get(this._indexesKey());
        }
        if (!this._pageIndexes) {
            this._pageIndexes = [];
        }
        return this._pageIndexes;
    },

    getPageData: function (index) {
        let r = this._storage.get(this._dataKey(index));
        if (!r) {
            r = [];
        }
        return r;
    },

    add: function (obj) {
        let index = this._lastIndex();
        let i = 0;
        if (index) {
            i = index.i;
            if (index.l >= this._pageSize) {
                i += 1;
                index = null;
            }
        }
        if (!index) {
            index = {i: i, l: 0};
            this._addIndex(index);
        }
        let d = this.getPageData(index.i);
        d.push(obj);
        index.l += 1;
        this._saveIndexes();
        this._storage.put(this._dataKey(index.i), d);
    }
};

function Pledge() {
    this._contractName = "Pledge";
    LocalContractStorage.defineProperties(this, {
        _canPledge: null,
        _canExport: null,
        _managers: null
    });
    LocalContractStorage.defineMapProperty(this, "_storage", {
        parse: function (text) {
            return JSON.parse(text);
        },
        stringify: function (obj) {
            return JSON.stringify(obj);
        }
    });
    this._addressList = new PageList(this._storage, "addresses");

    this.STATE_NONE = 0;
    this.STATE_PLEDGED = 1;
    this.STATE_CANCELED = 2;

    this._unit = new BigNumber(10).pow(18);
}

Pledge.prototype = {

    init: function (managers) {
        if (!managers || managers.length === 0) {
            throw ("Need at least one administrator");
        }
        for (let i = 0; i < managers.length; ++i) {
            this._verifyAddress(managers[i]);
        }
        this._canPledge = true;
        this._canExport = true;
        this._managers = managers;
    },

    _getInt: function (num) {
        if (!/^\d+$/.test(num + "")) {
            throw (num + " is not an integer.");
        }
        return parseInt(num);
    },

    _verifyAddress: function (address) {
        if (Blockchain.verifyAddress(address) === 0) {
            throw ("Address error");
        }
    },

    _addAddress: function (address) {
        this._addressList.add(address);
    },

    _getPledge: function (address) {
        return this._storage.get(address);
    },

    _setPledge: function (address, pledge) {
        this._storage.put(address, pledge);
    },

    _verifyManager: function () {
        if (this._managers.indexOf(Blockchain.transaction.from) < 0) {
            throw ("No permission");
        }
    },

    _getPledgeState: function () {
        let a = Blockchain.transaction.from;
        let p = this._getPledge(a);
        if (!p) {
            return this.STATE_NONE;
        }
        return !p.c ? this.STATE_PLEDGED : this.STATE_CANCELED;
    },

    pledge: function () {
        if (!this._canPledge) {
            throw ("This contract no longer accepts new pledges, please use the official new contract.");
        }

        let s = this._getPledgeState();
        if (s === this.STATE_PLEDGED) {
            throw ("You already have a pledge.");
        }
        if (this._unit.gt(Blockchain.transaction.value)) {
            throw ("The amount cannot be less than 1 NAS");
        }
        let a = Blockchain.transaction.from;
        let b = Blockchain.block.height;
        let v = new BigNumber(Blockchain.transaction.value).div(this._unit).toString(10);
        let p = this._getPledge(a);
        if (!p) {
            this._addAddress(Blockchain.transaction.from);
        }
        p = {b: b, v: v, c: false};
        this._setPledge(a, p);
    },

    cancelPledge: function () {
        let s = this._getPledgeState();
        if (s !== this.STATE_PLEDGED) {
            throw ("No pledges that can be cancelled.");
        }
        let a = Blockchain.transaction.from;
        let p = this._getPledge(a);
        let v = new BigNumber(p.v).mul(this._unit);
        Blockchain.transfer(a, v);
        p.c = true;
        this._setPledge(a, p);
        Event.Trigger("transfer", {
            Transfer: {
                from: Blockchain.transaction.to,
                to: a,
                value: v,
            }
        });
    },

    stopPledge: function () {
        this._verifyManager();
        this._canPledge = false;
    },

    transferAmount: function (natContractAddress) {
        this._verifyManager();
        let b = Blockchain.getAccountState(Blockchain.transaction.to).balance;
        let r = Blockchain.transfer(natContractAddress, new BigNumber(b));
        if (r) {
            Event.Trigger("transfer", {
                Transfer: {
                    from: Blockchain.transaction.to,
                    to: natContractAddress,
                    value: b,
                }
            });
        }
        return r;
    },

    exportDataToNat: function (natContractAddress) {
        this._verifyManager();
        if (!this._canExport) {
            throw ("Data has been exported.");
        }

        let nat = new Blockchain.Contract(natContractAddress);

        let data = [];
        let indexes = this.getAddressIndexes();
        for (let i = 0; i < indexes.length; ++i) {
            let index = indexes[i];
            let as = this.getAddresses(index.i);
            for (let j = 0; j < as.length; ++j) {
                data.push({a: as[j], p: this._getPledge(as[j])});
            }
        }
        nat.call("receivePledgeData", data);
        this._canExport = false;
    },

    getAddressIndexes: function () {
        return this._addressList.getPageIndexes();
    },

    getAddresses: function (index) {
        return this._addressList.getPageData(index);
    },

    getPledgeWithAddress: function (address) {
        return this._getPledge(address);
    },

    accept: function () {
        Event.Trigger("transfer", {
            Transfer: {
                from: Blockchain.transaction.from,
                to: Blockchain.transaction.to,
                value: Blockchain.transaction.value,
            }
        });
    }
};

module.exports = Pledge;
