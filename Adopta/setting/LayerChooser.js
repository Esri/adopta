///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define([
  'dojo/_base/declare',
  'jimu/BaseWidgetSetting',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/_base/lang',
  'dojo/on',
  'dojo/dom-class',
  'dojo/text!./LayerChooser.html',
  'jimu/dijit/LayerChooserFromMap',
  'jimu/dijit/LayerChooserFromMapWithDropbox',
  'dojo/domReady!'
], function (
  declare,
  BaseWidgetSetting,
  _WidgetsInTemplateMixin,
  lang,
  on,
  domClass,
  layerChooserTemplate,
  LayerChooserFromMap,
  LayerChooserFromMapWithDropbox
) {
  return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-adopta-setting',
    templateString: layerChooserTemplate,
    loginFieldInfo: {},
    selectedLayerDetails: {},
    startup: function () {
      this.inherited(arguments);
    },

    postCreate: function () {
      this._fetchAssetLayers();
      this.own(on(this.cancelButton, 'click', lang.hitch(this,
        function (evt) {
          this.onCancelClick(evt);
        })));
      this.own(on(this.okButton, 'click', lang.hitch(this, function () {
        if (!domClass.contains(this.okButton, "jimu-state-disabled")) {
          this.onOKButtonClicked(this.selectedLayerDetails);
        }
      })));
    },

    /**
   * This function is used to create asset layer dropdown
   * @memberOf widgets/Adopta/settings/Settings
   **/
    _fetchAssetLayers: function () {
      var args, templayerChooserFromMap, layerChooserFromMap, types, featureLayerFilter,
        queryableLayerFilter, filters;
      types = [''];
      featureLayerFilter = LayerChooserFromMap.createFeaturelayerFilter(types, false);
      queryableLayerFilter = LayerChooserFromMap.createQueryableLayerFilter();
      filters = [featureLayerFilter, queryableLayerFilter];
      args = {
        multiple: false,
        createMapResponse: this.map.webMapResponse,
        showLayerTypes: ['FeatureLayer'],
        filter: LayerChooserFromMap.andCombineFilters(filters)
      };
      templayerChooserFromMap = new LayerChooserFromMap(args);
      layerChooserFromMap = new LayerChooserFromMapWithDropbox({
        layerChooser: templayerChooserFromMap
      });
      layerChooserFromMap.placeAt(this.layerChooserDiv);
      layerChooserFromMap.startup();
      this.own(on(layerChooserFromMap, 'selection-change', lang.hitch(
        this, function (evt) {
          domClass.remove(this.okButton, "jimu-state-disabled");
          this.setSelectedLayerDetails(evt);
        })));
    },

    /**
    * Event which will be generated on clicking cancel button
    * @param {object} evt
    * @memberOf widgets/Adopta/settings/TableField.js
    **/
    onOKButtonClicked: function () {
      return this.selectedLayerDetails;
    },

    /**
    * Event which will be generated on clicking cancel button
    * @param {object} evt
    * @memberOf widgets/Adopta/settings/TableField.js
    **/
    onCancelClick: function (evt) {
      return evt;
    },

    /**
    * Event which will be generated when field name is empty
    * @param {string} message
    * @memberOf widgets/Adopta/settings/TableField.js
    **/
    showError: function (msg) {
      return msg;
    },

    setSelectedLayerDetails: function (evt) {
      this.selectedLayerDetails.id = evt[0].id;
      this.selectedLayerDetails.url = evt[0].url;
      this.selectedLayerDetails.geometryType = evt[0].geometryType;
      return this.selectedLayerDetails;
    }
  });
});


