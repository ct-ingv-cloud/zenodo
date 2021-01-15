// This file is part of Zenodo.
// Copyright (C) 2017 CERN.
//
// Zenodo is free software; you can redistribute it
// and/or modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation; either version 2 of the
// License, or (at your option) any later version.
//
// Zenodo is distributed in the hope that it will be
// useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Zenodo; if not, write to the
// Free Software Foundation, Inc., 59 Temple Place, Suite 330, Boston,
// MA 02111-1307, USA.
//
// In applying this license, CERN does not
// waive the privileges and immunities granted to it by virtue of its status
// as an Intergovernmental Organization or submit itself to any jurisdiction.

function retrieveMetadata($rootScope, InvenioRecordsAPI, $http, $q ) {
  var pdz_dep_url = 'https://pdz-dev.ddns.net:5000/api/deposit/depositions/';
  var config = 'Authorization: Bearer TOKEN';

// Oggetti di supporto per il mapping ** Potrebbero esser Maps
  var mapping = {
    //DATACITE    :   ZENODO 
    "id"      :   "doi_url", 
    "doi"     :   "doi",

    "types"     :   "upload_type",
    "creators"    :   "creators",
    "descriptions"  :   "description",
    "subjects"    :   "keywords",

    "geoLocations"  :   "locations"
  };

  var upload_type_mapping = {
    "Journal Article"   :   "article",
    "ScholarlyArticle"    :   "article",
    "Conference Abstract"   :   "conferencepaper",

    "Dataset"         :   "dataset",

    "Presentation"      :   "presentation",
    "Software"        :   "software",
    "Poster"        :   "poster"
  };

  function parser(dc, metadata) {
    //Object.entries(mapping).forEach(([key, value]) => {
    //for (var [key, value] of Object.entries(mapping)) {
    for(var key in mapping) {
      var value = mapping[key];
      // Controlla la presenza della chiave nel mapping-schema per ogni coppia (chiave,valore)
      if (key in dc) {

        // GENERICA STRINGA : Ogni tipo stringa generica viene semplicemente rimappato
        // Esempio: id->doi_url, doi->doi

        if (typeof dc[key] === "string")
          metadata[value] = dc[key];
        
        // TIPO di UPLOAD : Controlla il tipo di upload e lo rimappa nello schema Zenodo,
        // utilizzando il dizionario di mapping ausiliario upload_type_mapping;
        // Viene utilizzata la chiave 'schemaOrg' come campo chiave nello schema Datacite,
        // e viene cercata una corrispondenza del valore a tale chiave nel upload_type_mapping;
        // Esempio: Journal Article->article, Dataset->dataset

        if (typeof dc[key] === "object" && key === "types") {
          if (dc[key].hasOwnProperty('schemaOrg')) {
            //for (var [umk, umv] of Object.entries(upload_type_mapping)) {
            for ( var umk in upload_type_mapping) {
              var umv = upload_type_mapping[umk];
              if (umk === dc[key].schemaOrg) {
                metadata[value] = umv;
                break;
              }
              else
                metadata[value] = 'other';
            }
          }
        }

        // LISTA di CREATORI : L'input nello schema DC è un Array; Viene scorso e per ogni
        // elemento viene preso il campo 'name' e la sua 'affiliation' secondo lo schema Zenodo

        if (key === "creators") {
          var creators = [];
          //dc[key].forEach(element => {
          for ( var element in dc[key] ) {
            var creator = {};
            creator['name'] = element.name;

            if (element.hasOwnProperty('affiliation')) {
              //element.affiliation.forEach(e => {
              for ( var e in element.affiliation ) {
                creator['affiliation'] = e.name;  
              };
            }
            creators.push(creator);
          };
          metadata[value] = creators;
        }
        
        //KEYWORDS DC(Array)
        if (key === "subjects") {
          var keywords = [];
          //dc[key].forEach(element => {
          for ( var element in dc[key] ) {
            keywords.push(element.subject);
          };
          metadata[value] = keywords;
        }
        
        //DESCRIPTION DC(Array)
        if (key === "descriptions") {
          var description = '';
          //dc[key].forEach(element => {
          for ( var element in dc[key] ) {
            description = description.concat(element.description);
          };
          metadata[value] = description;
        }

        //GEOLOCATION DC(Array)
        if (key === "geoLocations") {
          var locations = [];

          //dc[key].forEach(loc => {
          for ( var loc in dc[key] ) {
            var location = {};
            
            if (loc.hasOwnProperty('geoLocationPoint')) {
              if (loc.geoLocationPoint.pointLatitude !== undefined) {
                location['lat'] = loc.geoLocationPoint.pointLatitude;
              }
              if (loc.geoLocationPoint.pointLongitude !== undefined) {
                location['lon'] = loc.geoLocationPoint.pointLongitude;
              }
            }

            if (loc.hasOwnProperty('geoLocationPlace'))
              location['place'] = loc.geoLocationPlace;

            // Prova a stimare un punto mediano nel parallelogramma
            if (loc.hasOwnProperty('geoLocationBox')) {
              location['lat'] = loc.geoLocationBox.northBoundLatitude - ((loc.geoLocationBox.northBoundLatitude - loc.geoLocationBox.southBoundLatitude)/2); 
              location['lon'] = loc.geoLocationBox.eastBoundLongitude - ((loc.geoLocationBox.eastBoundLongitude - loc.geoLocationBox.westBoundLongitude)/2);
            }

            locations.push(location);  
          };

          metadata[value] = locations;
        }
      }
    };
    return metadata;
  }

  function link($scope, elem, attrs, vm) {
  //console.log('DBG:Retrieve Metadata:Link Function loaded');
  //$scope.model.datacite_metadata = 0
    $scope.retrieveMetadata = function(rec) {
      //console.log('DBG:Button pressed');
      //console.log(rec);
      //$scope.model.datacite_metadata = 1

      var dc_url = "https://api.datacite.org/dois/" + rec.doi;
      var dc_metadata = {};

      $http({
        method : "GET",
        url : dc_url
      }).then(function mySuccess(response) {
        dc_metadata = response.data.data;
        var url = pdz_dep_url + rec.recid;

        // 1 Deposition from Record
        //
        $http.get(url, {}, config).then(function(response) {
          // 2 Unlock Edit Action
          // in response.data retrieve metadata field
          //
          $http.post(url + '/actions/edit', {}, config).then(function(response) {
            // 3 Remapping metadata
            //
            response.data.metadata = parser(dc_metadata, response.data.metadata);

            //console.log(response.data.metadata);
            $http.put(url, {'metadata': response.data.metadata}, config).then(function(response) {
              // 4 Action Publish
              //
              $http.post(url + '/actions/publish', {}, config).then(function(response) {
                // Published
                //
                //console.log(response);
              }, function (error) {
                //console.log('STEP 4');
                console.error(error);
                $http.post(url + '/actions/discard', {}, config).then(function(response) {}, function(error) {});
              });
            }, function(error) { //Call discard action
              //console.log('STEP 3');
              console.error(error);
              $http.post(url + '/actions/discard', {}, config).then(function(response) {}, function(error) {});
            });

          }, function (error) { 
            //console.log('STEP 2'); 
            console.error(error) });
        }, function(error) { 
            //console.log('STEP 1'); 
            console.error(error) });

        //$scope.model.datacite_metadata = 1
      }, function myError(response) {
        $scope.statusText = response.statusText;
      });
    }
  }
  return {
    scope: false,
    restrict: 'A',
    link: link,
  };
}

retrieveMetadata.$inject = [
  '$rootScope',
  'InvenioRecordsAPI',
  '$http',
  '$q',
  '$interval',
];

angular.module('invenioRecords.directives')
  .directive('retrieveMetadata', retrieveMetadata);
