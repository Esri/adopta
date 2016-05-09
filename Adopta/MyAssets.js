define([
  'dojo/_base/declare',
  'dojo/_base/array',
  'jimu/BaseWidget',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./MyAssets.html',
  'dojo/_base/lang',
  'dojo/Evented',
  'dojo/dom-class',
  'dojo/dom-style',
  'esri/tasks/query',
  'dojo/dom-construct',
  'dojo/dom-attr',
  'dojo/on',
  'dojo/query',
  'dojo/Deferred',
  'esri/symbols/jsonUtils'
], function (
  declare,
  array,
  BaseWidget,
  _WidgetsInTemplateMixin,
  MyAssetsTemplate,
  lang,
  Evented,
  domClass,
  domStyle,
  Query,
  domConstruct,
  domAttr,
  on,
  query,
  Deferred,
  symbolJsonUtils
) {
  return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {
    baseClass: 'jimu-widget-Adopta-MyAssets',
    templateString: MyAssetsTemplate, //set template string
    myAssets: null,
    _primaryAction: null,
    _updateLayerTimer: null,
    _actionPerformed: [],
    _selectedAsset: null,
    constructor: function (options) {
      lang.mixin(this, options);
    },

    postCreate: function () {
      this.inherited(arguments);
      domClass.add(this.domNode, "esriCTFullHeight");
      //get primary action (i.e. action to be displayed in my asset list)
      this._setPrimaryAction();

      on(this.layer, "update-end", lang.hitch(this, function () {
        if (this._updateLayerTimer && this.myAssets && this.myAssets.length > 0) {
          clearTimeout(this._updateLayerTimer);
          console.log("clear");
        }
        this._updateLayerTimer = setTimeout(lang.hitch(this, function () {
          if (this.config.userDetails) {
            var queryField, i;
            queryField = new Query();
            queryField.where = this.config.assetLayerDetails.keyField + " = '" +
              this.config.userDetails[this.config.relatedTableDetails.keyField] + "'";
            queryField.returnGeometry = true;
            queryField.outFields = ["*"];
            // Query for the features with the loggedin UserID
            this.layer.queryFeatures(queryField, lang.hitch(this, function (
                response) {
              for (i = 0; i < response.features.length; i++) {
                //update symbol in layer of myassets
                this._updateSymbol(response.features[i]);
              }
            }));
            this._updateLayerTimer = null;
          }
        }), 100);
      }));
    },

    /**
    * Set's primary action to be considered from the configuration
    * @memberOf widgets/Adopta/MyAssets
    **/
    _setPrimaryAction: function () {
      var i;
      if (this.config.actions.unAssign.displayInMyAssets) {
        this._primaryAction = lang.clone(this.config.actions.unAssign);
      }
      else {
        for (i = 0; i < this.config.actions.additionalActions.length; i++) {
          if (this.config.actions.additionalActions[i].displayInMyAssets) {
            this._primaryAction = lang.clone(this.config.actions.additionalActions[i]);
            break;
          }
        }
      }
    },

    /**
    * Display list of my assets
    * @memberOf widgets/Adopta/MyAssets
    **/
    showMyAssets: function () {
      domClass.add(this.selecetAssetSection, "esriCTHidden");
      domClass.remove(this.myAssetsSection, "esriCTHidden");
    },

    /**
    * Display list of my assets
    * @memberOf widgets/Adopta/MyAssets
    **/
    showSelectAsssetSection: function () {
      domClass.remove(this.selecetAssetSection, "esriCTHidden");
      domClass.add(this.myAssetsSection, "esriCTHidden");
    },

    /**
    * Returns the title to be shown in my asset list of the selected feature
    * @param {Object} selectedFeature
    * @memberOf widgets/Adopta/MyAssets
    **/
    _getAssetTitle: function (selectedFeature) {
      var assetTitle;
      if (lang.trim(this.config.nickNameField) !== "" &&
        selectedFeature.attributes[this.config.nickNameField] &&
        lang.trim(selectedFeature.attributes[this.config.nickNameField]) !== "") {
        assetTitle = lang.trim(selectedFeature.attributes[this.config.nickNameField]);
      } else if (lang.trim(selectedFeature.getTitle()) !== "") {
        assetTitle = lang.trim(selectedFeature.getTitle());
      } else if (selectedFeature.attributes[this.layer.displayField]) {
        assetTitle = selectedFeature.attributes[this.layer.displayField];
      } else {
        assetTitle = "";
      }
      return assetTitle;
    },

    /**
    * Create the list of my assets
    * @memberOf widgets/Adopta/MyAssets
    **/
    createMyAssets: function () {
      var item, i, itemHighlighter, itemTitle, itemActionButton;
      //clear previously added my assets
      domConstruct.empty(this.myAssetsSection);
      if (this.myAssets && this.myAssets.length > 0) {
        for (i = 0; i < this.myAssets.length; i++) {
          this._updateSymbol(this.myAssets[i]);
          item = domConstruct.create("div", {
            "class": "esriCTListItem"
          }, this.myAssetsSection);
          itemHighlighter = domConstruct.create("div", {
            "class": "esriCTListItemHighlight"
          }, item);
          itemTitle = domConstruct.create("div", {
            "class": "esriCTListItemTitle esriCTCursorPointer esriCTEllipsis"
          }, item);

          //if action is already performed, remove button and add green check image
          if (this._actionPerformed.indexOf(this.myAssets[i].attributes
            [this.layer.objectIdField]) !== -1) {
            itemActionButton = domConstruct.create("div", {
              "class": "esriCTGreenCheck esriCTActionPerformed"
            }, item);
          } else {
            itemActionButton = domConstruct.create("div", {
              "class": "esriCTListItemActionButton jimu-btn"
            }, item);
            domAttr.set(itemActionButton, "innerHTML", this._primaryAction.name);
            domAttr.set(itemActionButton, "title", this._primaryAction.name);
          }

          //set attributes to div which can be used to fetch feature from myAsset array
          domAttr.set(itemActionButton, "assetId", i);
          domAttr.set(item, "assetId", i);
          domAttr.set(item, "objectId", this.myAssets[i].attributes[this.layer.objectIdField]);
          //set action attribute to action button
          domAttr.set(itemActionButton, "action", this._primaryAction.name);
          //set asset title & action button title
          domAttr.set(itemTitle, "innerHTML", this._getAssetTitle(this.myAssets[i]));
          domAttr.set(itemTitle, "title", this._getAssetTitle(this.myAssets[i]));
          //handle click events to show asset details
          on(item, "click", lang.hitch(this, this._showAssetDetails));
          on(itemActionButton, "click", lang.hitch(this, this.performAction));

          //If asset is aleady selected highlight it
          if (this._selectedAsset && this._selectedAsset.toString() ===
            this.myAssets[i].attributes[this.layer.objectIdField].toString()) {
            this._highlightRow(item);
            this.emit("highlightMyAsset", this.myAssets[i]);
          }
        }
      } else {
        domClass.remove(this.selecetAssetSection, "esriCTHidden");
        domClass.add(this.myAssetsSection, "esriCTHidden");
      }
    },

    /**
    * Update feature symbol
    * @memberOf widgets/Adopta/MyAssets
    **/
    _updateSymbol: function (feature) {
      var symbol = symbolJsonUtils.fromJson(this.config.myAssetSymbol);
      feature.setSymbol(symbol);
    },

    /**
    * Emits event to display asset details using selected feature
    * @param {Object} evt contains the node on which clicked
    * @memberOf widgets/Adopta/MyAssets
    **/
    _showAssetDetails: function (evt) {
      var assetIndex;
      assetIndex = domAttr.get(evt.currentTarget, "assetId");
      this._highlightRow(evt.currentTarget);
      this.emit("showAssetDetails", this.myAssets[assetIndex], this.myAssets.length);
    },


    /**
    * Gets all the assets adopted by logged in user.
    * @param {boolean} flag to check for execution of actions
    * @memberOf widgets/Adopta/MyAssets
    **/
    getMyAssets: function (performActionsFromURL) {
      var queryField;
      queryField = new Query();
      queryField.where = this.config.assetLayerDetails.keyField + " = '" +
        this.config.userDetails[this.config.relatedTableDetails.keyField] + "'";
      queryField.returnGeometry = true;
      queryField.outFields = ["*"];
      // Query for the features with the loggedin UserID
      this.layer.queryFeatures(queryField, lang.hitch(this, function (
          response) {
        this.myAssets = response.features;
        this.createMyAssets();
        this.updateMyAssetCount();
        if (performActionsFromURL) {
          this._performActionFromURL();
        }
      }));
    },

    /**
    * Clear previously highlighted row
    * @memberOf widgets/Adopta/MyAssets
    **/
    _clearHighlightedRow: function () {
      var prevSelectedItem;
      prevSelectedItem = query(".esriCTItemSelected", this.myAssetsSection);
      if (prevSelectedItem && prevSelectedItem[0]) {
        domClass.remove(prevSelectedItem[0], "esriCTItemSelected");
        domStyle.set(prevSelectedItem[0], "backgroundColor", "#fff");
      }
    },

    /**
    * Highlight selected row
    * @param {object} current node
    * @memberOf widgets/Adopta/MyAssets
    **/
    _highlightRow: function (currentTarget) {
      var currentSelectedItem;
      this._clearHighlightedRow();
      currentSelectedItem = query(".esriCTListItemHighlight", currentTarget);
      if (currentSelectedItem && currentSelectedItem[0]) {
        domStyle.set(currentSelectedItem[0], "backgroundColor", this.config.selectedThemeColor);
        domClass.add(currentSelectedItem[0], "esriCTItemSelected");
        this._selectedAsset = domAttr.get(currentTarget, "objectId");
      }
    },

    /**
    * Fetch node to be highlighted or clear all the other nodes which are highlighted
    * @param {string} object id of selected asset
    * @memberOf widgets/Adopta/MyAssets
    **/
    highlightItem: function (objectid) {
      if (query("[objectId = " + objectid + "]", this.myAssetsSection).length > 0) {
        this._highlightRow(query("[objectId = " + objectid + "]", this.myAssetsSection)[0]);
      } else {
        this._selectedAsset = null;
        this._clearHighlightedRow();
      }
    },

    /**
    * Update my assets count
    * @memberOf widgets/Adopta/MyAssets
    **/
    updateMyAssetCount: function () {
      this.emit("updateMyAssetCount", this.myAssets.length);
    },

    /**
    * Update my assets count
    * @param {object} event object
    * @memberOf widgets/Adopta/MyAssets
    **/
    performAction: function (evt) {
      var action, assetIndex;
      if (!domClass.contains(evt.currentTarget, "esriCTActionPerformed")) {
        action = domAttr.get(evt.currentTarget, "action");
        assetIndex = domAttr.get(evt.currentTarget, "assetId");
        this.emit("performAction", action, this.myAssets[assetIndex], false);
        domClass.add(evt.currentTarget, "esriCTActionPerformed");
      }
      //stop propagating list click event
      evt.stopPropagation();
    },

    /**
    * Store objectids of feature where primary action is already performed
    * @param {string} current action name
    * @param {string} object id of selected asset
    * @memberOf widgets/Adopta/MyAssets
    **/
    onActionPerformed: function (actionName, objectId) {
      //if selected action is primary action
      if (this._primaryAction.name === actionName) {
        //if selected action is performed on my asset
        if (this._actionPerformed && this._actionPerformed.indexOf(objectId) === -1) {
          this._actionPerformed.push(objectId);
        }
      }

      //If asset is abonded, remove it from the actionPerformed array
      if (this._actionPerformed && this._actionPerformed.indexOf(objectId) !== -1 &&
        actionName === this.config.actions.unAssign.name) {
        this._actionPerformed.splice(this._actionPerformed.indexOf(objectId), 1);
        this._selectedAsset = null;
      } else if (actionName === this.config.actions.unAssign.name) {
        this._selectedAsset = null;
      }
      //update my assets
      this.getMyAssets();
    },

    /**
    * Set selected asset in my asset
    * @param {string} object id of selected asset
    * @memberOf widgets/Adopta/MyAssets
    **/
    getSelectedAsset: function () {
      return this._selectedAsset;
    },

    /**
    * Set selected asset in my asset
    * @param {string} object id of selected asset
    * @memberOf widgets/Adopta/MyAssets
    **/
    setSelectedAsset: function (objectId) {
      this._selectedAsset = objectId;
    },

    /**
    * Store objectids of feature where primary action is already performed
    * @memberOf widgets/Adopta/MyAssets
    **/
    _performActionFromURL: function () {
      if (this.config.urlParams.hasOwnProperty(this.config.actions.unAssign.urlParameterLabel)) {
        array.some(this.myAssets, lang.hitch(this, function (currentGraphic) {
          if (currentGraphic.attributes[this.layer.objectIdField].toString() ===
            this.config.urlParams[this.config.actions.unAssign.urlParameterLabel].toString()) {
            this.emit("performAction", this.config.actions.unAssign.name, currentGraphic, true);
            return true;
          }
        }));
      } else {
        array.some(this.config.actions.additionalActions, lang.hitch(this,
          function (currentAction) {
          if (this.config.urlParams.hasOwnProperty(currentAction.urlParameterLabel)) {
            array.some(this.myAssets, lang.hitch(this, function (currentGraphic) {
              if (currentGraphic.attributes[this.layer.objectIdField].toString() ===
                this.config.urlParams[currentAction.urlParameterLabel].toString()) {
                this.emit("performAction", currentAction.name, currentGraphic, true);
                return true;
              }
            }));
            return true;
          }
        }));
      }
    },

    getMyAssetsList: function () {
      var queryField, deferred = new Deferred();
      queryField = new Query();
      queryField.where = this.config.assetLayerDetails.keyField + " = '" +
        this.config.userDetails[this.config.relatedTableDetails.keyField] + "'";
      queryField.returnGeometry = true;
      queryField.outFields = ["*"];
      // Query for the features with the loggedin UserID
      this.layer.queryFeatures(queryField, lang.hitch(this, function (
          response) {
        if (response && response.features) {
          deferred.resolve(response.features);
        } else {
          deferred.reject([]);
        }
      }), function () {
        deferred.reject([]);
      });
      return deferred;
    }
  });
});