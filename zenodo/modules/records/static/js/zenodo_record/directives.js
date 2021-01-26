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
  console.log('DBG:Retrieve Metadata Angular JS directive loaded');

  var pdz_dep_url = 'https://pdz-dev.ddns.net:5000/api/deposit/depositions/';
  var config = 'Authorization: Bearer TOKEN';

// Oggetti di supporto per il mapping ** Potrebbero esser Maps
  var mapping = {
    //DATACITE    :   ZENODO
    //"id"      :   "doi_url",
    "doi"           :   "doi",

    "types"         :   "upload_type",
    "creators"      :   "creators",
    "descriptions"  :   "description",
    "subjects"      :   "keywords",

    "geoLocations"  :   "locations"
  };

  var upload_type_mapping = {
    "Journal Article"       :   "publication",
    "ScholarlyArticle"      :   "publication",
    "Conference Abstract"   :   "conferencepaper",

    "Dataset"               :   "dataset",

    "Presentation"          :   "presentation",
    "Software"              :   "software",
    "Poster"                :   "poster"
  };

  function simpleParserNG(dc, metadata) {
    for(var key in mapping) {
      var value = mapping[key];
      // Controlla la presenza della chiave nel mapping-schema per ogni coppia (chiave,valore)
      if (key in dc) {
        // GENERICA STRINGA : Ogni tipo stringa generica viene semplicemente rimappato
        // Esempio: id->doi_url, doi->doi

        if (typeof dc[key] === "string") {
          metadata[value] = dc[key];
        }

        // TIPO di UPLOAD : Controlla il tipo di upload e lo rimappa nello schema Zenodo,
        // utilizzando il dizionario di mapping ausiliario upload_type_mapping;
        // Viene utilizzata la chiave 'schemaOrg' come campo chiave nello schema Datacite,
        // e viene cercata una corrispondenza del valore a tale chiave nel upload_type_mapping;
        // Esempio: Journal Article->article, Dataset->dataset

        if (typeof dc[key] === "object" && key === "types") {
          if (dc[key].hasOwnProperty('schemaOrg')) {
            for ( var umk in upload_type_mapping) {
              var umv = upload_type_mapping[umk];
              if (umk === dc[key].schemaOrg) {
                metadata[value] = umv;
                if (umv === "publication" && dc[key].schemaOrg === "ScholarlyArticle") {
                  metadata['publication_type'] = "article";
                }
                break;
              }
              else {
                metadata[value] = 'other';
              }
            }
          }
        }

        // LISTA di CREATORI : L'input nello schema DC è un Array; Viene scorso e per ogni
        // elemento viene preso il campo 'name' e la sua 'affiliation' secondo lo schema Zenodo

        if (key === "creators" && dc[key] && dc[key].length) {
          var creators = [];
          dc[key].forEach(function(element) {
            var creator = {};
            //creator['name'] = element.name;
            creator['name'] = element.familyName + " " + element.givenName;
            /*
            if (element.hasOwnProperty('affiliation')) {
              creator['affiliation'] = element.affiliation[0].name;
              
              //element.affiliation.forEach(function(e) {
              //  creator['affiliation'] = e.name;
              //});
            }*/
            creators.push(creator);
          });
          metadata[value] = creators;
        }

        //KEYWORDS DC(Array)
        if (key === "subjects" && dc[key] && dc[key].length) {
          var keywords = [];
          dc[key].forEach(function(element) {
            keywords.push(element.subject);
          });
          metadata[value] = keywords;
        }

        //DESCRIPTION DC(Array)
        if (key === "descriptions" && dc[key] && dc[key].length) {
          var description = '';
          dc[key].forEach(function(element) {
            description = description.concat(element.description);
          });
          metadata[value] = description;
        }

        //GEOLOCATION DC(Array)
        if (key === "geoLocations" && dc[key] && dc[key].length) {
          var locations = [];

          //dc[key].forEach(loc => {
          dc[key].forEach(function(loc) {
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
          });

          metadata[value] = locations;
        }
      }
    };
    return metadata;
  }

  function link($scope, elem, attrs, vm) {
    //console.log('DBG:Retrieve Metadata:Link Function loaded');
    $scope.retrieveMetadata = function(recDoi, recId) {

    //var dc_url = "https://api.datacite.org/dois/" + rec.doi;
    var dc_url = "https://api.datacite.org/dois/" + recDoi;
    var dc_metadata = {};

    $http({
      method : "GET",
      url : dc_url
    }).then(function mySuccess(response) {
      dc_metadata = response.data.data;
      var url = pdz_dep_url + recId; //rec.recid;

      // 1 Deposition from Record
      //
      $http.get(url, {}, config).then(function(response) {
        // 2 Unlock Edit Action
        // in response.data retrieve metadata field
        //
        $http.post(url + '/actions/edit', {}, config).then(function(response) {
          // 3 Remapping metadata
          //
          response.data.metadata = simpleParserNG(dc_metadata.attributes, response.data.metadata);
          $http.put(url, {'metadata': response.data.metadata}, config).then(function(response) {
            // 4 Action Publish
            //
            $http.post(url + '/actions/publish', {}, config).then(function(response) {
              // Published
              //
            }, function (error) {
              console.log('ERR:STEP 4');
              console.error(error);
              $http.post(url + '/actions/discard', {}, config).then(function(response) {}, function(error) {});
            });
          }, function(error) { //Call discard action
            console.log('ERR:STEP 3');
            console.error(error);
            $http.post(url + '/actions/discard', {}, config).then(function(response) {}, function(error) {});
          });

        }, function (error) { console.log('ERR:STEP 2'); console.error(error) });
      }, function(error) { console.log('ERR:STEP 1'); console.error(error) });

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
