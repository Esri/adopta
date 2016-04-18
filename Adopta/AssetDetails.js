define([
  'dojo/_base/declare',
  'dojo/_base/array',
  'jimu/BaseWidget',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./AssetDetails.html',
  'dojo/_base/lang',
  'dijit/layout/ContentPane',
  'dojo/on',
  'dojo/dom-construct',
  'dojo/dom-class',
  'dojo/dom-attr',
  'dijit/form/TextBox',
  'esri/tasks/locator',
  'esri/geometry/webMercatorUtils',
  'esri/tasks/query',
  'dojo/Evented'
], function (
  declare,
  array,
  BaseWidget,
  _WidgetsInTemplateMixin,
  template,
  lang,
  ContentPane,
  on,
  domConstruct,
  domClass,
  domAttr,
  TextBox,
  Locator,
  webMercatorUtils,
  Query,
  Evented
) {
  return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {

    baseClass: 'jimu-widget-Adopta-AssetDetails',
    templateString: template,
    nickNameInputTextBox: null,
    layer: null,
    constructor: function (options) {
      lang.mixin(this, options);
    },

    postCreate: function () {
      domClass.add(this.domNode, "esriCTFullHeight");

      //create container to display feature popup info
      this._featureInfoPanel = new ContentPane({
        "id": 'divFeatureInfoContent'
      }, this.assetInfoPopupDetails);
      this._featureInfoPanel.startup();

      //Check for reverse geocoding Boolean flag
      if (this.config.showReverseGeocodedAddress) {
        domClass.remove(this.streetAddressContainer, "esriCTHidden");
        this._initReverseGeocoder();
      }
    },

    /**
    * Create details panel for selected asset
    * @param {object} selected feature
    * @memberOf widgets/Adopta/AssetDetails
    */
    showAssetInfoPopup: function (selectedFeature) {
      var assetStatus;
      this.selectedFeature = selectedFeature;
      this.showPanel("assetDetails");
      this._featureInfoPanel.setContent(this.selectedFeature.getContent());
      if (this._locatorInstance) {
        this._locatorInstance.locationToAddress(webMercatorUtils.webMercatorToGeographic(
        selectedFeature.geometry), 100);
      }
      assetStatus = this._checkAssetAdoptionStatus();
      this._createAdoptActionContainer(assetStatus);
    },

    /**
    * Check whether the asset is already adopted or not
    * @memberOf widgets/Adopta/AssetDetails
    */
    _checkAssetAdoptionStatus: function () {
      var relatedGUID, isAssetAdopted = false, isAssetAdoptedByLoggedInUser = false;
      relatedGUID = this.selectedFeature.attributes[this.map._layers[
        this.config.assetLayerDetails.id].relationships[0].keyField];
      if (relatedGUID && relatedGUID !== null && lang.trim(relatedGUID) !== "") {
        isAssetAdopted = true;
      }
      if (this.config.userDetails && isAssetAdopted && relatedGUID === this.config.userDetails[
      this.config.relatedTableDetails.keyField]) {
        isAssetAdoptedByLoggedInUser = true;
      }
      return {
        "isAssetAdopted": isAssetAdopted,
        "isAssetAdoptedByLoggedInUser": isAssetAdoptedByLoggedInUser
      };
    },

    /**
    * Create action container as per configuration
    * @param {object} selected assets status
    * @memberOf widgets/Adopta/AssetDetails
    */
    _createAdoptActionContainer: function (assetStatus) {
      var nicknameContainer, adoptBtnContainer, adoptBtn;
      domConstruct.empty(this.adoptActionContainer);
      //Hide textbox if asset is already adopted by other user
      if (!assetStatus.isAssetAdopted || assetStatus.isAssetAdoptedByLoggedInUser) {
        nicknameContainer = domConstruct.create("div", {}, this.adoptActionContainer);
        //TODO : create actions container
        this.nickNameInputTextBox = new TextBox({
          placeHolder: this.nls.nameAssetTextBoxPlaceholder
        });
        this.nickNameInputTextBox.placeAt(nicknameContainer);
      }
      adoptBtnContainer = domConstruct.create("div", {
        "class": "esriCTAdoptButtonContainer"
      }, this.adoptActionContainer);
      adoptBtn = domConstruct.create("div", {
        "class": "esriCTAdoptButton esriCTEllipsis jimu-btn"
      }, adoptBtnContainer);
      this._setAdoptButtonState(assetStatus, adoptBtn);
      on(adoptBtn, "click", lang.hitch(this, function () {
        if (!domClass.contains(adoptBtn, "jimu-state-disabled")) {
          var isNewAssetAdopted = false;
          //Check if user is logged in and accordingly perform the actions
          if (this.config.userDetails) {
            if (domAttr.get(adoptBtn, "innerHTML") === this.config.actions.assign.assignLabel) {
              isNewAssetAdopted = true;
            }
            this._adoptAsset(isNewAssetAdopted);
          } else {
            this.emit("adoptAsset", {
              "adoptId": this.selectedFeature.attributes[this.layer.objectIdField]
            });
            this.showPanel("login");
          }
        }
      }));
    },

    /**
    * Set appropriate adopt button label
    * @param {object} selected assets status
    * @param {object} adopt button
    * @memberOf widgets/Adopta/AssetDetails
    */
    _setAdoptButtonState: function (assetStatus, adoptBtn) {
      var buttonText;
      if (assetStatus.isAssetAdopted && !assetStatus.isAssetAdoptedByLoggedInUser) {
        domClass.add(adoptBtn, "jimu-state-disabled");
        buttonText = this.config.actions.assign.assignedLabel;
      } else {
        if (assetStatus.isAssetAdoptedByLoggedInUser) {
          if (this.config.nickNameField !== "") {
            this.nickNameInputTextBox.set("value", this.selectedFeature.attributes[this.config
            .nickNameField]);
          }
          buttonText = this.nls.nickNameUpdateButtonLabel;
        } else {
          buttonText = this.config.actions.assign.assignLabel;
        }
      }
      domAttr.set(adoptBtn, "innerHTML", buttonText);
    },

    /**
    * emit name of panel that needs to be shown
    * @param {string} name panel to be shown
    * @memberOf widgets/Adopta/AssetDetails
    */
    showPanel: function (panel) {
      this.emit("showPanel", panel);
    },

    /**
    * This function initialize the Locator widget for reverse geocoding
    * @memberOf widgets/Adopta/AssetDetails
    */
    _initReverseGeocoder: function () {
      //By default if no geocoding service available in org then ArcGis online GeocodeServer will be used for reverse geocoding.
      var geocodeURL =
        "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      if (this.config.helperServices && this.config.helperServices.geocode &&
        this.config.helperServices.geocode[0] && this.config.helperServices
        .geocode[0].url) {
        geocodeURL = this.config.helperServices.geocode[0].url;
      }
      //create the locator instance to reverse geocode the address
      this._locatorInstance = new Locator(geocodeURL);
      this._locatorInstance.on("location-to-address-complete",
        lang.hitch(this, this._onLocationToAddressComplete));
      //Listen for error in locator
      this._locatorInstance.onError = lang.hitch(this, function (err) {
        this._onLocationToAddressFailed(err);
      });
    },

    /**
    * Callback handler called once location is reverse geocoded
    * @param {object} result of reverse geocoding
    * @memberOf widgets/Adopta/AssetDetails
    */
    _onLocationToAddressComplete: function (result) {
      //check if address available
      if (result.address && result.address.address) {
        this.locationAddress.innerHTML = result.address.address.Address;
      }
    },

    /**
    * Error back handler called once location is not reverse geocoded
    * @memberOf widgets/Adopta/AssetDetails
    */
    _onLocationToAddressFailed: function () {
      this.locationAddress.innerHTML = this.nls.streetAddressNotFoundText;
    },

    /**
    * Function to adopt an selected asset
    * @param {boolean} Flag to check if selected is adopted/updated
    * @memberOf widgets/Adopta/AssetDetails
    */
    _adoptAsset: function (isNewAssetAdopted) {
      var adoptedAssetString;
      this.loading.show();
      //Check if nick name field is empty
      if (lang.trim(this.nickNameInputTextBox.getValue()) !== "") {
        this.selectedFeature.attributes[this.config.nickNameField] = this.nickNameInputTextBox
         .getValue();
      }

      if (lang.trim(this.selectedFeature.getTitle()) !== "") {
        adoptedAssetString = lang.trim(this.selectedFeature.getTitle());
      } else if (this.selectedFeature.attributes[this.layer.displayField]){
          adoptedAssetString = this.selectedFeature.attributes[this.layer.displayField];
      } else {
        adoptedAssetString = "";
      }
      this._updateFieldsForAdoption();
      //Add users guid into asset to identify which asset belongs to user
      this.selectedFeature.attributes[this.config.assetLayerDetails.keyField] = this.config
        .userDetails[this.config.relatedTableDetails.keyField];
      this.layer.applyEdits(null, [this.selectedFeature], null, lang.hitch(this,
        function (added, updated, deleted) {
        /*jshint unused: false*/
        if (updated[0].success) {
          //Refresh layer and show the updated information in asset details panel
          this.layer.refresh();
          this.showAssetInfoPopup(this.selectedFeature);
          if (isNewAssetAdopted) {
            this.emit("showMessage", this.nls.adoptionCompleteMsg + " " + adoptedAssetString);
            //If asset is adopted, increment the count of total number of adopted asset by logged in user
            this.emit("assetAdopted");
          }
        } else {
          //Show error if adoption fails
          this.emit("showMessage", this.nls.unableToAdoptAssetMsg);
        }
        this.loading.hide();
      }), lang.hitch(this, function () {
        //Show error if adoption fails
        this.emit("showMessage", this.nls.unableToAdoptAssetMsg);
        this.loading.hide();
      }));
    },

    /**
    * Function to update the fields specified in actions
    * @memberOf widgets/Adopta/AssetDetails
    */
    _updateFieldsForAdoption: function () {
      array.forEach(this.config.actions.assign.fieldsToUpdate, lang.hitch(this,
        function (currentAction) {
        switch (currentAction.action) {
          case "SetValue":
            this.selectedFeature.attributes[currentAction.field] = currentAction.value;
            break;
          case "SetDate":
            this.selectedFeature.attributes[currentAction.field] = Date.now();
            break;
          case "Clear":
            this.selectedFeature.attributes[currentAction.field] = null;
            break;
        }
      }));
    },

    /**
    * Function to fetch selected asset through URL parameter
    * @param {string} selected asset id
    * @param {string} value to be inserted in nick name field
    * @memberOf widgets/Adopta/AssetDetails
    */
    fetchSelectedAsset: function (assetId) {
      var queryField;
      queryField = new Query();
      queryField.where = this.layer.objectIdField + " = " + assetId;
      queryField.returnGeometry = true;
      queryField.outFields = ["*"];
      // Query for the features with the logged in UserId
      this.layer.queryFeatures(queryField, lang.hitch(this, function (
          response) {
        if (response && response.features[0]) {
          this.showAssetInfoPopup(response.features[0]);
          this._adoptAsset(true);
          this.emit("highlightFeatureOnMap", this.selectedFeature);
        } else {
          //Show error if adoption fails
          this.emit("showMessage", this.nls.assetNotFoundMsg);
        }
      }));
    }
  });
});