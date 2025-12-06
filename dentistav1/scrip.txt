$(document).ready(function() {
    $('#upload-form').submit(function(e) {
        e.preventDefault();
        $('#errorMessage').hide();

        let fileInput = $('#file-input')[0].files;
        if (fileInput.length === 0) {
            $('#errorMessage').show();
            return;
        }

        let formData = new FormData();
        formData.append('file', fileInput[0]);
        formData.append('custom_prompt', $('#custom_prompt').val());
        formData.append('model', $('#model').val());
        formData.append('format', $('#format').val());

        $('#progress-container').show();
        $('#progress-bar').width('0%').html('0%');

        $.ajax({
            xhr: function() {
                let xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener("progress", function(evt) {
                    if (evt.lengthComputable) {
                        let percentComplete = Math.round((evt.loaded / evt.total) * 100);
                        $('#progress-bar').width(percentComplete + '%');
                        $('#progress-bar').html(percentComplete + '%');
                    }
                }, false);
                return xhr;
            },
            type: 'POST',
            url: '/',
            data: formData,
            contentType: false,
            processData: false,
            success: function(response) {
                $('#progress-container').hide();
                $('#extracted-text').text(response.extracted_text || 'No text found.');
            },
            error: function() {
                $('#progress-container').hide();
                alert('An error occurred while processing your request.');
            }
        });
    });
});
