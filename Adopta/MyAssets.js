define([
  'dojo/_base/declare',
  'jimu/BaseWidget',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./MyAssets.html',
  'dojo/_base/lang',
  'dojo/Evented',
  'dojo/dom-class',
  'esri/tasks/query'
], function (
  declare,
  BaseWidget,
  _WidgetsInTemplateMixin,
  MyAssetsTemplate,
  lang,
  Evented,
  domClass,
  Query
) {
  return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {
    baseClass: 'jimu-widget-Adopta-MyAssets',
    templateString: MyAssetsTemplate, //set template string
    myAssets: null,
    constructor: function (options) {
      lang.mixin(this, options);
    },

    postCreate: function () {
      this.inherited(arguments);
      domClass.add(this.domNode, "esriCTFullHeight");
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
    * Gets all the assets adopted by logged in user.
    * @memberOf widgets/Adopta/MyAssets
    **/
    getMyAssets: function () {
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
        this.updateMyAssetCount();
      }));
    },

    /**
    * Update my assets count
    * @memberOf widgets/Adopta/MyAssets
    **/
    updateMyAssetCount: function () {
      this.emit("updateMyAssetCount", this.myAssets.length);
    }

  });
});