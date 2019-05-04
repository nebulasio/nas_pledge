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
    },

    addPage: function (page) {
        let i = 0;
        let index = this._lastIndex();
        if (index) {
            i = index.i + 1;
        }
        index = {i: i, l: page.length};
        this._addIndex(index);
        this._storage.put(this._dataKey(index.i), page);
    }
};


function TestNat() {
    this._contractName = "TestNat";

    LocalContractStorage.defineMapProperty(this, "_storage", {
        parse: function (text) {
            return JSON.parse(text);
        },
        stringify: function (obj) {
            return JSON.stringify(obj);
        }
    });

    this._pledgeDataPrefix = "pledge_";

    this._pledgeAddressList = new PageList(this._storage, "pledge_address_list");
}

TestNat.prototype = {

    init: function () {
    },

    _pledgeDataKey: function (address) {
        return this._pledgeDataPrefix + address;
    },

    _getPledge: function (address) {
        return this._storage.get(this._pledgeDataKey(address));
    },

    _setPledge: function (address, pledge) {
        this._storage.put(this._pledgeDataKey(address), pledge);
    },

    receivePledgeData: function (data) {
        // TODO: Add permission verification
        for (let i = 0; i < data.length; ++i) {
            let a = data[i].a;
            let p = data[i].p;
            this._pledgeAddressList.add(a);
            this._setPledge(a, p);
        }
    },

    getAddressIndexes: function () {
        return this._pledgeAddressList.getPageIndexes();
    },

    getAddresses: function (index) {
        return this._pledgeAddressList.getPageData(index);
    },

    getPledgeWithAddress: function (address) {
        return this._getPledge(address);
    },

    // 回收测试币到测试地址
    recycling: function () {
        let b = Blockchain.getAccountState(Blockchain.transaction.to).balance;
        Blockchain.transfer("n1Z6MhSZa321SnpiKfUWiybQSG3GCmRHunv", b);
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

module.exports = TestNat;
