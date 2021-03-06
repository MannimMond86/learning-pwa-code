// @ts-check

/* eslint-env browser */
(function () {
  // @ts-ignore
  window.chartColors = {
    red: 'rgb(255, 99, 132)',
    orange: 'rgb(255, 159, 64)',
    yellow: 'rgb(255, 205, 86)',
    green: 'rgb(75, 192, 192)',
    blue: 'rgb(54, 162, 235)',
    purple: 'rgb(153, 102, 255)',
    grey: 'rgb(201, 203, 207)'
  };

  /**
   * @param {string | string[]} theStr 
   */
  function toTitleCase(theStr) {
    // borrowed from:
    // https://gomakethings.com/converting-a-string-to-title-case-with-vanilla-javascript/
    theStr = theStr.toLowerCase().split(' ');
    for (var i = 0; i < theStr.length; i++) {
      theStr[i] = theStr[i].charAt(0).toUpperCase() + theStr[i].slice(1);
    }
    return theStr.join(' ');
  };

  /** 
   * @param {number} num 
   */
  function formatNumber(num) {
    // people seem to hate using commas in numbers nowadays
    // so, of course, I had to have them here
    // https://blog.abelotech.com/posts/number-currency-formatting-javascript/
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
  };

  /**
   * @param {*} chartData 
   */
  function renderSentimentData(chartData) {
    console.log('Rendering Sentiment data');
    // built from this sample: https://www.chartjs.org/samples/latest/charts/pie.html
    var ctx = document.getElementById('myChart').getContext('2d');
    // populate the attribData array with our sentiment data
    var attribData = [];
    var labelData = []
    for (var attribute in chartData) {
      let titleAttrib = toTitleCase(attribute);
      attribData.push(chartData[attribute]);
      labelData.push(titleAttrib);
      // update the table on the page
      document.getElementById(`val${titleAttrib}`).innerHTML = formatNumber(chartData[attribute]);
    }

    var data = {
      datasets: [{
        data: attribData,
        backgroundColor: [
          window.chartColors.red,
          window.chartColors.orange,
          window.chartColors.grey,
          window.chartColors.green,
          window.chartColors.blue,
          window.chartColors.purple,
        ]
      }],
      labels: labelData,
    };

    var myDoughnutChart = new Chart(ctx, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        legend: { position: 'bottom' }
      }
    });
  };

  function getSentimentData() {
    console.log('getSentimentData()');
    // do we have a network connection?
    // build the URL to the app's APIs
    const serverUrl = `${location.origin}/api/sentiment`;
    console.log(`Getting data from ${serverUrl}`);
    // see if you can get the data from the network
    fetch(serverUrl)
      .then(res => {
        console.log('Received data from the server');
        res.json()
          .then(chartData => {
            // update the page with the new data
            renderSentimentData(chartData);
            // set the data source element in the footer
            document.getElementById('sourceValue').textContent = DATA_SOURCES[0];
          })
      })
      .catch(error => {
        let msg = `Error fetching data: ${error}`;
        console.error(msg);
        // update the Source and data state values in the footer
        document.getElementById('sourceValue').textContent = DATA_STATES[2];
        // display a warning dialog (using Sweet Alert 2)
        Swal.fire('Data Error', msg, 'error');
      });
  };

  /**
   * 
   * @param {string} selectedSentiment 
   */
  function postFeedback(selectedSentiment) {
    console.log('postFeedback()');
    // build the URL to the app's APIs
    const serverUrl = `${location.origin}/api/sentiment`;

    console.log(`Submitting data to ${serverUrl}`);
    // the data we're passing to the server
    const data = { sentiment: selectedSentiment };
    // POST the data to the server    
    fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(response => {
        console.log('Received response from the server');
        if (response.status == 201) {
          // it worked
          console.log('Sentiment submitted');
          // update the page with the latest data
          getSentimentData();
        } else {
          // tell the user it failed
          Swal.fire('POST Error', response.statusText, 'error');
        }
      });
  };

  function queueFeedback(db, feedback) {
    console.log('queueFeedback()');
    return new Promise((resolve, reject) => {
      let request = db.transaction([STORE_NAME], "readwrite")
        .objectStore(STORE_NAME)
        .add({ timestamp: Date.now(), sentiment: feedback });
  
      request.onsuccess = function (event) {
        console.log('queueFeedback: Successfully added feedback');
        navigator.serviceWorker.ready.then(reg => {
          console.log('queueFeedback: Registering sync event');
          // fire off the sync request
          // to the service worker
          reg.sync.register('feedback')
            .then(() => {
              // tell the user
              Swal.fire({
                type: 'info',
                title: 'Request Queued',
                text: 'Your sentiment rating was queued for ' +
                  'submission to the server.',
                footer: 'Please refresh the page.',
              });
              // and resolve the promise
              resolve();
            })
            .catch(() => {
              // I can't think of why this would happen
              reject();
            })
  
        });
      };
  
      request.onerror = function (event) {
        // unable to create transaction
        reject(db.error);
      };
    });
  };

  function submitFeedback() {
    // the user tapped the Share Sentiment button
    console.log('submitFeedback()');
    // get the selected item from the form
    var theSelect = document.getElementById("sentiment");
    let selectedSentiment = theSelect.options[theSelect.selectedIndex].value;
    // do we have a sentiment selected? we should
    if (selectedSentiment) {
      console.log(`submitFeedback: '${selectedSentiment}' selected`);
      // is IndexedDB supported?
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        // yes, save the feedback to the database
        openIDB()
          .then(db => {
            queueFeedback(db, selectedSentiment)
              .then(() => {
                console.log('submitFeedback: Successfully queued feedback');
              })
              .catch(error => {
                console.error(error);
                Swal.fire('Sync Error', error, 'error');
              })
          })
      } else {
        // service worker or sync not supported
        // so do this the old fashioned way
        postFeedback(selectedSentiment);
      }
    }
  };

  // set the onClick event for the `btnShare` button
  document.getElementById("btnShare").addEventListener("click", submitFeedback);

  // go get the data for the page
  getSentimentData();

})();
