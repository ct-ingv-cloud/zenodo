// This file is part of Zenodo and Zenodo adaptations for INGV - Osservatorio Etneo.
//
// Zenodo Copyright (C) 2017 CERN.
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
    //console.log('DBG:Retrieve Metadata Angular JS directive loaded');


  var pdz_dep_url = 'https://pdz-dev.ddns.net:5000/api/deposit/depositions/';
  var config = 'Authorization: Bearer TOKEN';


  function simpleParser(data, metadata) {
        var metadataResult = {};
        //console.log(data);

          //LOCATIONS
          var result = [];
          var locations = data.attributes['geoLocations'];
          locations.forEach(function(loc) {
                var obj= {};
                if ('geoLocationPlace' in loc)
                        obj['place'] = loc.geoLocationPlace;
                if ('geoLocationPoint' in loc) {
                        if (loc.geoLocationPoint.pointLatitude !== undefined) {
                                obj['lat'] = loc.geoLocationPoint.pointLatitude;
                        }
                        if (loc.geoLocationPoint.pointLongitude !== undefined) {
                                obj['lon'] = loc.geoLocationPoint.pointLongitude;
                        }
                }
                if ('geoLocationBox' in loc) {
                        if (loc.geoLocationBox.eastBoundLongitude !== undefined) {
                                obj['lon'] = loc.geoLocationBox.eastBoundLongitude;
                        }
                        if (loc.geoLocationBox.northBoundLatitude !== undefined) {
                                obj['lat'] = loc.geoLocationBox.northBoundLatitude;
                        }
                }
                result.push(obj);
          });
          metadata['locations'] = result;

          //KEYWORDS
          result = [];
          data.attributes['subjects'].forEach(function(subj) {
                result.push(subj['subject']);
          });
          metadata['keywords'] = result;

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
            response.data.metadata = simpleParser(dc_metadata, response.data.metadata);

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
